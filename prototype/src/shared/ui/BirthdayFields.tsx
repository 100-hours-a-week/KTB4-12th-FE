import { useMemo } from 'react';

type BirthdayFieldsProps = {
  value: string;
  onChange: (value: string) => void;
};

function parseBirthday(value: string) {
  const [year, month, day] = value.split('.').map(Number);
  return {
    year: Number.isFinite(year) ? year : 2000,
    month: Number.isFinite(month) ? month : 1,
    day: Number.isFinite(day) ? day : 1,
  };
}

function formatBirthday(year: number, month: number, day: number) {
  return `${year}.${String(month).padStart(2, '0')}.${String(day).padStart(2, '0')}`;
}

export function BirthdayFields({ value, onChange }: BirthdayFieldsProps) {
  const birthday = parseBirthday(value);
  const latestYear = new Date().getFullYear() - 14;
  const years = useMemo(
    () => Array.from({ length: 87 }, (_, index) => latestYear - index),
    [latestYear],
  );
  const daysInMonth = new Date(birthday.year, birthday.month, 0).getDate();

  const change = (next: Partial<typeof birthday>) => {
    const merged = { ...birthday, ...next };
    const safeDay = Math.min(merged.day, new Date(merged.year, merged.month, 0).getDate());
    onChange(formatBirthday(merged.year, merged.month, safeDay));
  };

  return (
    <div className="birthday-selects">
      <label>
        <span>년</span>
        <select
          aria-label="출생 연도"
          value={birthday.year}
          onChange={(event) => change({ year: Number(event.target.value) })}
        >
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>월</span>
        <select
          aria-label="출생 월"
          value={birthday.month}
          onChange={(event) => change({ month: Number(event.target.value) })}
        >
          {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
            <option key={month} value={month}>
              {String(month).padStart(2, '0')}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>일</span>
        <select
          aria-label="출생 일"
          value={Math.min(birthday.day, daysInMonth)}
          onChange={(event) => change({ day: Number(event.target.value) })}
        >
          {Array.from({ length: daysInMonth }, (_, index) => index + 1).map((day) => (
            <option key={day} value={day}>
              {String(day).padStart(2, '0')}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
