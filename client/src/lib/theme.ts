// Theme utility functions
export const initializeTheme = () => {
  const savedTheme = localStorage.getItem('theme') || 'system';
  applyTheme(savedTheme);
  return savedTheme;
};

export const applyTheme = (theme: string) => {
  const root = document.documentElement;
  
  if (theme === 'system') {
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.toggle('dark', systemPrefersDark);
  } else if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
};

export const setTheme = (theme: string) => {
  localStorage.setItem('theme', theme);
  applyTheme(theme);
};

// Listen for system theme changes
export const setupSystemThemeListener = () => {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  
  const handleChange = () => {
    const currentTheme = localStorage.getItem('theme');
    if (currentTheme === 'system') {
      applyTheme('system');
    }
  };
  
  mediaQuery.addEventListener('change', handleChange);
  
  // Return cleanup function
  return () => mediaQuery.removeEventListener('change', handleChange);
};