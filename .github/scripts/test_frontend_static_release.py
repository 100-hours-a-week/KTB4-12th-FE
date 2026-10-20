"""FE 정적 발행·승격 실패 복구 모의 테스트."""
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("static_release", ROOT / ".github/scripts/frontend-static-release.py")
cd = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cd)


class StaticTests(unittest.TestCase):
    def test_frontend_preflight_metadata_and_no_container_start(self):
        operations = []
        def api(service, operation, *args):
            operations.append(operation)
            if operation == "get-public-access-block":
                return {"PublicAccessBlockConfiguration": {key: True for key in (
                    "BlockPublicAcls", "IgnorePublicAcls", "BlockPublicPolicy", "RestrictPublicBuckets")}}
            if operation == "get-bucket-versioning":
                return {"Status": "Enabled"}
            if operation == "get-distribution":
                return {"Distribution": {"Status": "Deployed", "DistributionConfig": {"Enabled": True,
                    "Origins": {"Items": [{"Id": "s3", "DomainName": cd.BUCKET + ".s3.ap-northeast-2.amazonaws.com",
                        "OriginPath": "/frontend/staging", "OriginAccessControlId": "oac"}]},
                    "DefaultCacheBehavior": {"TargetOriginId": "s3"}}}}
            if operation == "get-bucket-policy":
                return {"Policy": json.dumps({"Statement": [{"Effect": "Allow", "Principal": {"Service": "cloudfront.amazonaws.com"},
                    "Action": "s3:GetObject", "Resource": f"arn:aws:s3:::{cd.BUCKET}/frontend/staging/*",
                    "Condition": {"StringEquals": {"AWS:SourceArn": f"arn:aws:cloudfront::{cd.ACCOUNT}:distribution/E123456789"}}}]})}
            if operation == "describe-repositories":
                return {"repositories": [{"imageTagMutability": "IMMUTABLE"}]}
            if operation == "describe-images":
                return {"imageDetails": [{"imageDigest": "sha256:" + "a" * 64}]}
            if operation == "get-object":
                key = args[args.index("--key") + 1]
                Path(args[-1]).write_text("old-index" if key.endswith("index.html") else "same-asset")
                return {"VersionId": "old", "ETag": "etag"}
            self.fail("사전 검사 중 허용하지 않은 API: " + operation)
        def download(api, release, directory):
            site = directory / "site"
            (site / "assets").mkdir(parents=True)
            (site / "assets/app-hash.js").write_text("same-asset")
            (site / "index.html").write_text("new-index")
            return site, {"version": release, "revision": "a" * 40}
        with tempfile.TemporaryDirectory() as temporary, patch.object(cd, "download_release", side_effect=download), patch.dict(
                os.environ, {"V2_FRONTEND_BUCKET": cd.BUCKET, "V2_CLOUDFRONT_DISTRIBUTION_ID": "E123456789"}):
            plan = cd.prepare_frontend(api, "staging", "1.3.2", Path(temporary))
            self.assertEqual(plan["existing"], {"assets/app-hash.js"})
        self.assertFalse(set(operations) & cd.MUTATIONS)
    def test_static_rejects_symlinks_maps_and_hidden_files(self):
        with tempfile.TemporaryDirectory() as temporary:
            site = Path(temporary)
            (site / "index.html").write_text("index")
            self.assertEqual(len(cd.validate_site(site)), 1)
            for name in ("secret.map", ".env", "other.html"):
                path = site / name
                path.write_text("not-public")
                with self.assertRaises(cd.DeliveryError):
                    cd.validate_site(site)
                path.unlink()
            (site / "linked.js").symlink_to(site / "index.html")
            with self.assertRaises(cd.DeliveryError):
                cd.validate_site(site)

    def test_assets_before_index_and_no_delete(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            site = directory / "site"
            (site / "assets").mkdir(parents=True)
            (site / "assets/app-hash.js").write_text("new-js")
            (site / "index.html").write_text("new-index")
            previous = directory / "previous"
            previous.write_text("old-index")
            objects = {"frontend/staging/index.html": b"old-index"}
            writes = []
            def api(service, operation, *args):
                if operation == "get-object":
                    key = args[args.index("--key") + 1]
                    Path(args[-1]).write_bytes(objects[key])
                    return {"VersionId": "old" if objects[key] == b"old-index" else "new", "ETag": "test-etag"}
                if operation == "put-object":
                    key = args[args.index("--key") + 1]
                    writes.append(key)
                    objects[key] = Path(args[args.index("--body") + 1]).read_bytes()
                    return {"VersionId": "new"}
                if operation == "create-invalidation":
                    return {"Invalidation": {"Id": "inv"}}
                if operation == "wait":
                    return {}
                self.fail("예상하지 않은 API: " + operation)
            plan = {"files": list(site.rglob("*.js")) + [site / "index.html"], "site": site,
                    "prefix": "frontend/staging/", "bucket": cd.BUCKET, "distribution": "DIST",
                    "previous": previous, "previous_metadata": {"VersionId": "old"}, "index_attempted": False}
            cd.apply_frontend(api, plan)
            self.assertEqual(writes, ["frontend/staging/assets/app-hash.js", "frontend/staging/index.html"])

    def test_frontend_rollback_uses_conditional_write_and_checks_content(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            site = directory / "site"
            site.mkdir()
            (site / "index.html").write_bytes(b"new-index")
            previous = directory / "previous"
            previous.write_bytes(b"old-index")
            current = b"new-index"
            def api(service, operation, *args):
                nonlocal current
                if operation == "get-object":
                    Path(args[-1]).write_bytes(current)
                    return {"ETag": "current-etag"}
                if operation == "put-object":
                    self.assertEqual(args[args.index("--if-match") + 1], "current-etag")
                    current = Path(args[args.index("--body") + 1]).read_bytes()
                    return {}
                if operation == "create-invalidation":
                    return {"Invalidation": {"Id": "inv"}}
                return {}
            plan = {"site": site, "previous": previous, "previous_metadata": {"CacheControl": "no-cache"},
                    "index_attempted": True, "bucket": "bucket", "prefix": "frontend/staging/", "distribution": "DIST"}
            cd.rollback_frontend(api, plan)
            self.assertEqual(current, b"old-index")

    def test_dry_run_blocks_write(self):
        with patch.object(cd.subprocess, "run") as run:
            with self.assertRaises(cd.DeliveryError):
                cd.Aws(False)("s3api", "put-object")
            run.assert_not_called()

    def test_missing_object_403_is_not_confused_with_real_access_denial(self):
        with tempfile.TemporaryDirectory() as temp:
            key = "releases/frontend/1.3.2/manifest.json"
            def missing(service, operation, *args):
                if operation == "get-object":
                    raise cd.AwsError(operation, "AccessDenied")
                self.assertEqual(operation, "list-objects-v2")
                self.assertEqual(args[args.index("--prefix") + 1], key)
                return {"Contents": []}
            self.assertIsNone(cd.get_object(missing, cd.BUCKET, key, Path(temp) / "file"))
            def denied(service, operation, *args):
                if operation == "get-object":
                    raise cd.AwsError(operation, "AccessDenied")
                return {"Contents": [{"Key": key}]}
            with self.assertRaises(cd.AwsError):
                cd.get_object(denied, cd.BUCKET, key, Path(temp) / "file")

    def test_publish_manifest_last_and_conflict(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            site = root / "site"
            site.mkdir()
            (site / "index.html").write_text("index")
            objects, writes = {}, []
            def api(service, op, *args):
                if op == "get-bucket-versioning":
                    return {"Status": "Enabled"}
                if op == "get-public-access-block":
                    return {"PublicAccessBlockConfiguration": dict.fromkeys(
                        ["BlockPublicAcls", "IgnorePublicAcls", "BlockPublicPolicy", "RestrictPublicBuckets"], True)}
                key = args[args.index("--key") + 1]
                if op == "head-object":
                    return {"ContentLength": len(objects[key])}
                if op == "get-object":
                    if key not in objects:
                        raise cd.AwsError(op, "NoSuchKey")
                    Path(args[-1]).write_bytes(objects[key])
                    return {"VersionId": "v"}
                self.assertEqual(op, "put-object")
                self.assertIn("--if-none-match", args)
                writes.append(key)
                objects[key] = Path(args[args.index("--body") + 1]).read_bytes()
                return {"VersionId": "v"}
            cd.publish(api, "1.3.2", "a" * 40, site, root)
            self.assertTrue(writes[-1].endswith("/manifest.json"))
            before = len(writes)
            cd.publish(api, "1.3.2", "a" * 40, site, root)
            self.assertEqual(len(writes), before)
            download = root / "download"
            download.mkdir()
            downloaded, manifest = cd.download_release(api, "1.3.2", download)
            self.assertEqual((downloaded / "index.html").read_text(), "index")
            self.assertEqual(manifest["revision"], "a" * 40)
            with self.assertRaises(cd.DeliveryError):
                cd.publish(api, "1.3.2", "b" * 40, site, root)

    def test_download_rejects_traversal_and_checksum_mismatch(self):
        for relative in ("../escape.js", "index.html"):
            manifest = {"version": "1.3.2", "revision": "a" * 40,
                        "files": {relative: "a" * 64, "index.html": "a" * 64}}
            def api(service, op, *args):
                if op == "head-object":
                    return {"ContentLength": 100}
                key = args[args.index("--key") + 1]
                Path(args[-1]).write_text(json.dumps(manifest) if key.endswith("manifest.json") else "wrong")
                return {"VersionId": "v"}
            with tempfile.TemporaryDirectory() as temp:
                with self.assertRaises(cd.DeliveryError):
                    cd.download_release(api, "1.3.2", Path(temp))

    def test_delivery_has_no_docker_ecr_and_production_requires_staging(self):
        script = (ROOT / ".github/scripts/frontend-static-release.py").read_text()
        self.assertNotIn('"docker"', script)
        self.assertNotIn('"ecr"', script)
        workflow = (ROOT / ".github/workflows/frontend-static-delivery.yml").read_text()
        self.assertIn("needs: [resolve, staging]", workflow)
        guard = (ROOT / ".github/workflows/frontend-static-deliver.yml").read_text()
        self.assertIn("required_reviewers", guard)
        self.assertIn("FE_CD_READY", guard)


if __name__ == "__main__":
    unittest.main()
