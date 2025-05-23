export const SearchInput: React.FC<{ value: string; onChange: (text: string) => void; placeholder: string }> = ({
  value,
  onChange,
  placeholder,
}) => (
  <div className="relative mb-4">
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full p-2 pl-12 bg-primary-background text-primary-text placeholder-primary-text/50 border border-secondary-background rounded-lg text-lg focus:ring-2 focus:ring-tertiary-background focus:border-tertiary-background"
    />
    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-xl">🔍</span>
    {value && (
      <button
        onClick={() => onChange("")}
        className="absolute right-4 top-1/2 transform -translate-y-1/2 text-primary-text/50 hover:text-primary-text text-xl"
        tabIndex={-1}
      >
        ✕
      </button>
    )}
  </div>
);
