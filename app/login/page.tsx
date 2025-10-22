"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, LogIn, Loader2 } from "lucide-react"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    // Simulate login process
    setTimeout(() => {
      if (email === "admin@example.com" && password === "password") {
        localStorage.setItem("isAuthenticated", "true")
        router.push("/dashboard")
      } else {
        setError("Email atau password salah")
      }
      setIsLoading(false)
    }, 1000)
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "rgb(251, 251, 250)" }}>
      <div className="notion-card w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div
            className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
            style={{ background: "rgb(35, 131, 226)" }}
          >
            <LogIn className="h-8 w-8 text-white" />
          </div>
          <h1 className="notion-heading text-2xl mb-2">Welcome back</h1>
          <p className="notion-text" style={{ color: "rgb(120, 119, 116)" }}>
            Sign in to access your dashboard
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="block text-sm font-medium" style={{ color: "rgb(55, 53, 47)" }}>
              Email
            </label>
            <input
              type="email"
              placeholder="admin@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="notion-input w-full"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium" style={{ color: "rgb(55, 53, 47)" }}>
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="notion-input w-full pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div
              className="p-3 rounded"
              style={{
                background: "rgb(253, 235, 236)",
                borderLeft: "3px solid rgb(235, 87, 87)",
                color: "rgb(155, 44, 44)",
              }}
            >
              <p className="text-sm">{error}</p>
            </div>
          )}

          <button type="submit" disabled={isLoading} className="notion-button-primary w-full justify-center">
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              "Sign in"
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
