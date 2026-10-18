#!/usr/bin/env python3
"""FE 레포 전용: 버전별 정적 산출물 발행·동일 산출물 S3/CloudFront 승격."""
import argparse
import hashlib
import json
import mimetypes
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile

ACCOUNT = "721744297924"
REGION = "ap-northeast-2"
BUCKET = f"seonjalal-v2-frontend-{ACCOUNT}-{REGION}"
MUTATIONS = {"put-object", "create-invalidation"}


class DeliveryError(Exception):
    pass


class AwsError(DeliveryError):
    def __init__(self, operation, code):
        self.code = code
        super().__init__(operation + " CODE=" + code + ". 원문 비공개")


def require(condition, message):
    if not condition:
        raise DeliveryError(message)


class Aws:
    def __init__(self, apply):
        self.apply = apply

    def __call__(self, service, operation, *args, body=None):
        require(operation not in MUTATIONS or self.apply, "검증 모드에서 AWS 변경 차단")
        base = ["aws", "--region", REGION, "--no-cli-pager", "--cli-connect-timeout", "5", "--cli-read-timeout", "30",
                service, operation, *args, "--output", "json"]
        if body is not None:
            # Task Definition에 기존 민감 설정이 있을 수 있으므로 argv/로그/Artifact로 노출하지 않음.
            with tempfile.TemporaryDirectory(prefix="v2-request-") as temporary:
                path = Path(temporary) / "request.json"
                path.write_text(json.dumps(body))
                path.chmod(0o600)
                result = subprocess.run(base + ["--cli-input-json", "file://" + str(path)],
                                        capture_output=True, text=True, timeout=90)
        else:
            result = subprocess.run(base, capture_output=True, text=True, timeout=660)
        if result.returncode:
            match = re.search(r"An error occurred \(([A-Za-z0-9_.-]+)\)", result.stderr)
            raise AwsError(operation, match[1] if match else "CLI_OR_TRANSPORT_ERROR")
        return json.loads(result.stdout) if result.stdout.strip() else {}


def version(value):
    require(bool(re.fullmatch(r"[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z][0-9A-Za-z.-]*)?", value)),
            "릴리스 버전 형식 불일치")
    return value


def validate_site(site):
    files = sorted(site.rglob("*"))
    require(all(not item.is_symlink() for item in files), "정적 산출물 symlink 금지")
    files = [item for item in files if item.is_file()]
    require((site / "index.html").is_file() and 0 < len(files) <= 2000, "정적 index/파일 수 확인 필요")
    require(sum(item.stat().st_size for item in files) <= 100 * 1024**2, "정적 파일 크기 상한 초과")
    for path in files:
        relative = path.relative_to(site).as_posix()
        require(bool(re.fullmatch(r"[A-Za-z0-9_./@-]+", relative)) and
                not any(part.startswith(".") for part in path.relative_to(site).parts), "숨김파일/허용외 경로 금지")
        require(path.suffix != ".map", "공개 source map 배포 금지")
        require(path.suffix != ".html" or relative == "index.html", "현재 Delivery는 단일 SPA index만 지원")
    return files


def get_object(api, bucket, key, destination):
    try:
        return api("s3api", "get-object", "--bucket", bucket, "--key", key, str(destination))
    except AwsError as error:
        if error.code in ("NoSuchKey", "404"):
            return None
        if error.code in ("AccessDenied", "403"):
            # prefix 제한 ListBucket 권한에서는 없는 키도 403일 수 있음.
            # 허용된 정확한 prefix 조회로 부재만 확인하고 실제 접근 거부는 유지.
            listing = api("s3api", "list-objects-v2", "--bucket", bucket, "--prefix", key, "--max-keys", "1")
            if not any(item.get("Key") == key for item in listing.get("Contents", [])):
                return None
        raise


def prepare_frontend(api, env, release, directory):
    version(release)
    bucket = os.environ.get("V2_FRONTEND_BUCKET", "")
    distribution = os.environ.get("V2_CLOUDFRONT_DISTRIBUTION_ID", "")
    require(bucket == BUCKET and bool(re.fullmatch(r"[A-Z0-9]{8,32}", distribution)), "FE 버킷/CloudFront 환경 설정 필요")
    prefix = f"frontend/{env}/"
    access = api("s3api", "get-public-access-block", "--bucket", bucket)["PublicAccessBlockConfiguration"]
    require(all(access.get(key) is True for key in ("BlockPublicAcls", "IgnorePublicAcls", "BlockPublicPolicy", "RestrictPublicBuckets")),
            "공유 S3 공개 접근 차단 유지 필요")
    require(api("s3api", "get-bucket-versioning", "--bucket", bucket).get("Status") == "Enabled", "S3 버전 관리 필요")
    distro = api("cloudfront", "get-distribution", "--id", distribution)["Distribution"]
    config = distro["DistributionConfig"]
    require(config.get("Enabled") and distro.get("Status") == "Deployed", "CloudFront 배포 완료 필요")
    origins = config.get("Origins", {}).get("Items", [])
    expected_domain = bucket + f".s3.{REGION}.amazonaws.com"
    origin = next((item for item in origins if item.get("DomainName") == expected_domain and item.get("OriginPath") == "/" + prefix.rstrip("/")), None)
    require(origin and origin.get("OriginAccessControlId"), "환경 prefix 전용 S3 OAC 원본 필요")
    require(config.get("DefaultCacheBehavior", {}).get("TargetOriginId") == origin["Id"], "기본 원본 prefix 불일치")
    if env == "production":
        # FE는 /api 상대주소로빌드됨. 정적S3원본만준비하고운영화면완료로오인하지않음.
        require(any(item.get("PathPattern") in ("/api/*", "/api*") and item.get("TargetOriginId") != origin["Id"]
                    and "POST" in item.get("AllowedMethods", {}).get("Items", [])
                    for item in config.get("CacheBehaviors", {}).get("Items", [])),
                "운영CloudFront의/api→Backend원본라우팅이먼저필요")
    policy = json.loads(api("s3api", "get-bucket-policy", "--bucket", bucket)["Policy"])
    arn = f"arn:aws:cloudfront::{ACCOUNT}:distribution/{distribution}"
    require(any(item.get("Effect") == "Allow" and item.get("Principal") == {"Service": "cloudfront.amazonaws.com"}
                and item.get("Action") == "s3:GetObject" and item.get("Resource") == f"arn:aws:s3:::{bucket}/{prefix}*"
                and item.get("Condition", {}).get("StringEquals", {}).get("AWS:SourceArn") == arn
                for item in policy.get("Statement", [])), "해당 환경 CloudFront만 읽는 버킷 정책 필요")
    site, manifest = download_release(api, release, directory)
    files = validate_site(site)
    previous = directory / "previous-index.html"
    metadata = get_object(api, bucket, prefix + "index.html", previous)
    # assets는 기존 파일과 내용이 같거나 새 이름인 경우만 허용. 기존 탭의 chunk 삭제/덮어쓰기 방지.
    existing = set()
    for path in files:
        relative = path.relative_to(site).as_posix()
        if relative == "index.html":
            continue
        prior = directory / "compare-static"
        exists = get_object(api, bucket, prefix + relative, prior)
        if exists:
            require(hashlib.sha256(prior.read_bytes()).digest() == hashlib.sha256(path.read_bytes()).digest(),
                    "기존 정적 파일과 이름은 같지만 내용이 다름. 버전/해시 파일명 필요")
            existing.add(relative)
    return {"bucket": bucket, "prefix": prefix, "distribution": distribution, "manifest": manifest,
            "site": site, "files": files, "previous": previous, "previous_metadata": metadata,
            "index_attempted": False, "existing": existing}


def invalidate(api, plan):
    result = api("cloudfront", "create-invalidation", "--distribution-id", plan["distribution"], "--paths", "/*")
    api("cloudfront", "wait", "invalidation-completed", "--distribution-id", plan["distribution"],
        "--id", result["Invalidation"]["Id"])


def apply_frontend(api, plan):
    ordered = [path for path in plan["files"] if path.name != "index.html"] + [plan["site"] / "index.html"]
    for path in ordered:
        relative = path.relative_to(plan["site"]).as_posix()
        if relative in plan.get("existing", set()):
            continue
        conditions = ["--if-none-match", "*"]
        # 계획 후 다른CD가index를바꿨으면바로덮어쓰지않고중단. 환경concurrency도필수.
        if relative == "index.html":
            now = get_object(api, plan["bucket"], plan["prefix"] + relative, plan["site"].parent / "current-index")
            require((now or {}).get("VersionId") == (plan["previous_metadata"] or {}).get("VersionId"), "index 동시 배포 감지")
            if now:
                require(bool(now.get("ETag")), "index 조건부 쓰기 ETag 필요")
                conditions = ["--if-match", now["ETag"]]
            plan["index_attempted"] = True
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        result = api("s3api", "put-object", "--bucket", plan["bucket"], "--key", plan["prefix"] + relative,
                     "--body", str(path), "--content-type", mimetypes.guess_type(relative)[0] or "application/octet-stream",
                     "--cache-control", "no-cache" if relative == "index.html" else "public,max-age=31536000,immutable",
                     "--metadata", "sha256=" + digest, *conditions)
        if relative == "index.html":
            plan["new_index_version"] = result.get("VersionId")
        checked = plan["site"].parent / "verified-object"
        get_object(api, plan["bucket"], plan["prefix"] + relative, checked)
        require(hashlib.sha256(checked.read_bytes()).hexdigest() == digest, "S3 업로드 후 해시 검증 실패")
    invalidate(api, plan)


def rollback_frontend(api, plan):
    if not plan["index_attempted"]:
        return
    require(plan["previous_metadata"] is not None, "최초 FE 배포에는 이전index가없음. 수동복구필요")
    now_path = plan["site"].parent / "rollback-index-check"
    current = get_object(api, plan["bucket"], plan["prefix"] + "index.html", now_path)
    require(current is not None and now_path.read_bytes() in (plan["previous"].read_bytes(), (plan["site"] / "index.html").read_bytes()),
            "다른FE배포감지. 자동복구중단")
    metadata = plan["previous_metadata"]
    require(bool(current.get("ETag")), "index 조건부 복구 ETag 필요")
    api("s3api", "put-object", "--bucket", plan["bucket"], "--key", plan["prefix"] + "index.html",
        "--body", str(plan["previous"]), "--content-type", metadata.get("ContentType", "text/html"),
        "--cache-control", metadata.get("CacheControl", "no-cache"), "--if-match", current["ETag"])
    checked = plan["site"].parent / "rollback-index-verified"
    get_object(api, plan["bucket"], plan["prefix"] + "index.html", checked)
    require(checked.read_bytes() == plan["previous"].read_bytes(), "index 복구 후 내용 확인 실패")
    invalidate(api, plan)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def public_bucket(api):
    require(api("s3api", "get-bucket-versioning", "--bucket", BUCKET).get("Status") == "Enabled",
            "산출물 버킷 버전 관리 필요")
    access = api("s3api", "get-public-access-block", "--bucket", BUCKET)["PublicAccessBlockConfiguration"]
    require(all(access.get(k) is True for k in ("BlockPublicAcls", "IgnorePublicAcls", "BlockPublicPolicy", "RestrictPublicBuckets")),
            "버킷 공개 접근 차단 필요")


def immutable_put(api, key, path):
    # 같은 버전 재시도는 내용이 같은 경우만 허용. 삭제·덮어쓰기 없음.
    check = path.parent / ("check-" + hashlib.sha256(key.encode()).hexdigest())
    found = get_object(api, BUCKET, key, check)
    if found:
        require(sha(check) == sha(path), "기존 릴리스 산출물 충돌")
        check.unlink()
        return
    api("s3api", "put-object", "--bucket", BUCKET, "--key", key, "--body", str(path), "--if-none-match", "*")
    get_object(api, BUCKET, key, check)
    require(sha(check) == sha(path), "릴리스 업로드 해시 불일치")
    check.unlink()


def publish(api, release, revision, site, directory):
    version(release)
    require(bool(re.fullmatch(r"[0-9a-f]{40}", revision)), "소스 SHA 필요")
    public_bucket(api)
    files = validate_site(site)
    manifest = {"version": release, "revision": revision,
                "files": {p.relative_to(site).as_posix(): sha(p) for p in files}}
    metadata = directory / "manifest.json"
    metadata.write_text(json.dumps(manifest, sort_keys=True))
    key = f"releases/frontend/{release}/manifest.json"
    previous = directory / "previous-manifest.json"
    existing = get_object(api, BUCKET, key, previous)
    if existing:
        require(json.loads(previous.read_text()) == manifest, "같은 버전은 동일 소스·파일만 재발행 가능")
    # manifest는 모든 파일 검증 후 마지막에 발행. 중간 실패한 릴리스는 배포 불가.
    for path in files:
        immutable_put(api, f"releases/frontend/{release}/files/" + path.relative_to(site).as_posix(), path)
    immutable_put(api, key, metadata)
    print("FRONTEND_STATIC_RELEASE_PUBLISHED")


def download_release(api, release, directory):
    version(release)
    prefix = f"releases/frontend/{release}/"
    metadata = directory / "manifest.json"
    head = api("s3api", "head-object", "--bucket", BUCKET, "--key", prefix + "manifest.json")
    require(head["ContentLength"] <= 1024 * 1024, "manifest 크기 상한 초과")
    require(get_object(api, BUCKET, prefix + "manifest.json", metadata), "릴리스 manifest 없음")
    manifest = json.loads(metadata.read_text())
    require(manifest.get("version") == release and bool(re.fullmatch(r"[0-9a-f]{40}", manifest.get("revision", ""))),
            "릴리스 메타데이터 불일치")
    entries = manifest.get("files", {})
    require(isinstance(entries, dict) and 0 < len(entries) <= 2000 and "index.html" in entries, "릴리스 파일 목록 확인 필요")
    site = directory / "site"
    site.mkdir(mode=0o700)
    total = 0
    for relative, digest in entries.items():
        require(isinstance(relative, str) and bool(re.fullmatch(r"[A-Za-z0-9_./@-]+", relative))
                and not relative.startswith("/") and all(part and not part.startswith(".") for part in relative.split("/"))
                and bool(re.fullmatch(r"[0-9a-f]{64}", digest)), "릴리스 경로·해시 불일치")
        path = site / relative
        path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        key = prefix + "files/" + relative
        head = api("s3api", "head-object", "--bucket", BUCKET, "--key", key)
        total += head["ContentLength"]
        require(total <= 100 * 1024**2, "릴리스 크기 상한 초과")
        require(get_object(api, BUCKET, key, path), "릴리스 파일 없음")
        require(sha(path) == digest, "릴리스 파일 해시 불일치")
    validate_site(site)
    return site, manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["publish", "deploy"])
    parser.add_argument("--version", required=True)
    parser.add_argument("--environment", choices=["staging", "production"])
    parser.add_argument("--site", type=Path, default=Path("prototype/dist/client"))
    parser.add_argument("--revision", default=os.environ.get("GITHUB_SHA", ""))
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    require(os.environ.get("GITHUB_ACTIONS") == "true" and os.environ.get("GITHUB_REF") == "refs/heads/main",
            "FE main의 GitHub Actions에서만 실행")
    version(args.version)
    os.umask(0o077)
    with tempfile.TemporaryDirectory(prefix="fe-release-") as temporary:
        directory = Path(temporary)
        api = Aws(args.apply)
        require(api("sts", "get-caller-identity").get("Account") == ACCOUNT, "AWS 계정 불일치")
        if args.action == "publish":
            require(args.apply, "발행은 명시적 apply 필요")
            publish(api, args.version, args.revision, args.site, directory)
            return
        require(args.environment is not None and os.environ.get("FE_CD_READY") == "true", "FE 환경 준비 확인 필요")
        plan = prepare_frontend(api, args.environment, args.version, directory)
        if not args.apply:
            print("FRONTEND_RELEASE_VALIDATED_NO_WRITE")
            return
        try:
            apply_frontend(api, plan)
        except Exception:
            rollback_frontend(api, plan)
            raise
        print("FRONTEND_DEPLOYED_INFRA_VERIFIED_QA_PENDING")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print("STOP: " + (str(error) if isinstance(error, DeliveryError) else type(error).__name__), file=sys.stderr)
        raise SystemExit(1)
