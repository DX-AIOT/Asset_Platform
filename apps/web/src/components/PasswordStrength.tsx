interface PasswordStrengthProps {
  password: string;
}

export default function PasswordStrength({ password }: PasswordStrengthProps) {
  const getStrength = (pwd: string): 'weak' | 'medium' | 'strong' => {
    if (pwd.length < 6) return 'weak';

    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score++;
    if (/\d/.test(pwd)) score++;
    if (/[^a-zA-Z0-9]/.test(pwd)) score++;

    if (score < 2) return 'weak';
    if (score <= 3) return 'medium';
    return 'strong';
  };

  if (!password) return null;

  const strength = getStrength(password);
  const colors = {
    weak: 'bg-red-500',
    medium: 'bg-yellow-500',
    strong: 'bg-green-500',
  };

  const widths = {
    weak: 'w-1/3',
    medium: 'w-2/3',
    strong: 'w-full',
  };

  const labels = {
    weak: 'Weak',
    medium: 'Medium',
    strong: 'Strong',
  };

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-600">Password strength:</span>
        <span
          className={`text-xs font-medium ${
            strength === 'weak'
              ? 'text-red-600'
              : strength === 'medium'
                ? 'text-yellow-600'
                : 'text-green-600'
          }`}
        >
          {labels[strength]}
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all duration-300 ${colors[strength]} ${widths[strength]}`}
        />
      </div>
    </div>
  );
}
