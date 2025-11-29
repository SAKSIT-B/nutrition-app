import React, { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext(null)

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState('light')

  useEffect(() => {
    const saved = window.localStorage.getItem('theme')
    if (saved === 'dark' || saved === 'light') {
      setTheme(saved)
    }
  }, [])

  useEffect(() => {
    document.body.classList.toggle('theme-dark', theme === 'dark')
    window.localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'))

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
