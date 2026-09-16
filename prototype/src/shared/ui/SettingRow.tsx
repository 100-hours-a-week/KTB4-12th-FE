import { ChevronRightIcon } from '@radix-ui/react-icons';

export function SettingRow({
  label,
  value,
  onClick,
}: {
  label: string;
  value: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span>{label}</span>
      <span>
        {value}
        {onClick ? <ChevronRightIcon /> : null}
      </span>
    </>
  );
  return onClick ? (
    <button type="button" className="setting-row" onClick={onClick}>
      {content}
    </button>
  ) : (
    <div className="setting-row static">{content}</div>
  );
}
