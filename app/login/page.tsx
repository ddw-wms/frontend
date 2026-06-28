"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";
import { login } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [uFoc, setUFoc] = useState(false);
  const [pFoc, setPFoc] = useState(false);

  useEffect(() => {
    const savedUsername = localStorage.getItem("rememberedUsername");
    if (savedUsername) {
      setUsername(savedUsername);
      setRememberMe(true);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!username.trim() || !password.trim()) {
      toast.error("Please enter username and password");
      return;
    }

    setLoading(true);

    const wakeUpTimer = setTimeout(() => {
      toast.loading("⏳ Server is waking up... please wait (30-60 seconds)", {
        id: "wake-msg",
        duration: 120000,
      });
    }, 3000);

    try {
      await login(username, password);

      clearTimeout(wakeUpTimer);
      toast.dismiss("wake-msg");

      if (rememberMe) {
        localStorage.setItem("rememberedUsername", username);
      } else {
        localStorage.removeItem("rememberedUsername");
      }

      toast.success("✓ Login successful!", {
        icon: "🎉",
        duration: 1500,
      });

      const redirectTo = searchParams.get("redirect") || "/home";
      setTimeout(() => {
        router.push(redirectTo);
      }, 500);
    } catch (error: any) {
      clearTimeout(wakeUpTimer);
      toast.dismiss("wake-msg");

      const status = error.response?.status;
      const serverMessage =
        error.response?.data?.error || error.response?.data?.message;
      const attemptsLeft = error.response?.data?.attemptsLeft;
      const lockedUntil = error.response?.data?.lockedUntil;

      let errorMsg: string;
      let toastType: "error" | "warning" = "error";

      if (status === 503) {
        errorMsg =
          "Server is still starting up. Please wait a minute and try again.";
      } else if (status === 504) {
        errorMsg = "Request timed out. Please try again.";
      } else if (status === 429) {
        const retryAfter = error.response?.data?.retryAfter || 60;
        errorMsg = `⏳ Too many requests. Please wait ${retryAfter} seconds before trying again.`;
      } else if (
        error.code === "ERR_NETWORK" ||
        error.message === "Network Error"
      ) {
        errorMsg =
          "Cannot connect to server. Please check your internet connection or try again in a minute.";
      } else if (error.code === "ECONNABORTED") {
        errorMsg = "Connection timed out. Please try again.";
      } else if (status === 423) {
        if (lockedUntil) {
          const lockTime = new Date(lockedUntil);
          const minutesLeft = Math.ceil(
            (lockTime.getTime() - Date.now()) / 60000,
          );
          errorMsg = `🔒 Account locked. Try again in ${minutesLeft} minute${
            minutesLeft !== 1 ? "s" : ""
          }.`;
        } else {
          errorMsg =
            serverMessage ||
            "Account temporarily locked. Please try again later.";
        }
      } else if (status === 401) {
        if (attemptsLeft !== undefined && attemptsLeft !== null) {
          if (attemptsLeft <= 2 && attemptsLeft > 0) {
            errorMsg = `⚠️ ${serverMessage || "Invalid credentials"}`;
            toastType = "warning";
          } else if (attemptsLeft === 0) {
            errorMsg = `🔒 ${serverMessage || "Account locked due to too many failed attempts"}`;
          } else {
            errorMsg = serverMessage || "Invalid username or password";
          }
        } else {
          errorMsg = serverMessage || "Invalid username or password";
        }
      } else {
        errorMsg = serverMessage || "Login failed. Please try again.";
      }

      if (toastType === "warning") {
        toast.error(errorMsg, {
          style: {
            background: "#ff9800",
            color: "#000",
            fontWeight: 500,
          },
          duration: 4000,
        });
      } else {
        toast.error("✗ " + errorMsg, { duration: 4000 });
      }
    } finally {
      setLoading(false);
    }
  };

  const featureItems = [
    {
      n: "1",
      title: "Live Inventory Pipeline",
      desc: "Real-time visibility of stock through inbound, QC, picking, and outbound stages.",
      active: true,
    },
    {
      n: "2",
      title: "Inbound & Session Management",
      desc: "Batch receiving with WSN scanning, session submissions, and declared vs actual tracking.",
      active: true,
    },
    {
      n: "3",
      title: "Quality Control & Grading",
      desc: "Item-level QC with multi-grade categorization and rejection tracking.",
      active: true,
    },
    {
      n: "4",
      title: "Picking & Fulfillment",
      desc: "Demand-based picklists with box-level tracking and multi-item fulfillment.",
      active: false,
    },
    {
      n: "5",
      title: "Barcode Scanning & Mobile",
      desc: "On-floor barcode scanning for live inventory updates and accuracy.",
      active: false,
    },
  ];

  // UI Rendering===============================================
  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            fontFamily: "Inter, sans-serif",
            borderRadius: "12px",
            fontSize: "13px",
          },
        }}
      />

      <div className="login-page">
        <div className="bg-layer bg-gradient" />
        <div className="bg-layer bg-mesh" />
        <div className="bg-layer bg-dots" />
        <div className="bg-layer bg-rings" />

        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />

        {[...Array(18)].map((_, i) => (
          <span
            key={i}
            className="star"
            style={{
              left: `${(i * 29 + 8) % 96}%`,
              top: `${(i * 47 + 12) % 88}%`,
              animationDelay: `${(i * 0.17) % 2.6}s`,
            }}
          />
        ))}

        <div className="layout-shell">
          <section className="login-panel">
            <div className="login-card">
              <div className="login-card-glow" />

              <div className="mini-brand">
                <div className="mini-brand-icon-wrap">
                  <div className="mini-brand-ring" />
                  <div className="mini-brand-icon">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="white"
                      strokeWidth="2.1"
                    >
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                      <polyline points="9,22 9,12 15,12 15,22" />
                    </svg>
                  </div>
                </div>
                <div>
                  <div className="mini-brand-title">Divine WMS</div>
                  <div className="mini-brand-sub">
                    Warehouse Management System
                  </div>
                </div>
              </div>

              <div className="card-copy">
                <h1>Welcome Back</h1>
                <p>SIGN IN TO YOUR ACCOUNT</p>
              </div>

              <form
                onSubmit={handleLogin}
                noValidate
                autoComplete="on"
                className="form-stack"
              >
                <div className="field-block">
                  <label>User Name</label>
                  <div
                    className={`input-wrap ${uFoc || username ? "is-focused" : ""}`}
                  >
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      disabled={loading}
                      autoFocus
                      placeholder="name@company.com"
                      required
                      autoComplete="username"
                      onFocus={() => setUFoc(true)}
                      onBlur={() => setUFoc(false)}
                    />
                    {username && (
                      <span className="input-ok">
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </span>
                    )}
                  </div>
                </div>

                <div className="field-block">
                  <label>Password</label>
                  <div
                    className={`input-wrap ${pFoc || password ? "is-focused" : ""}`}
                  >
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                      placeholder="* * * * * * * *"
                      required
                      autoComplete="current-password"
                      onFocus={() => setPFoc(true)}
                      onBlur={() => setPFoc(false)}
                    />
                    <button
                      type="button"
                      className="eye-btn"
                      onClick={() => setShowPassword((v) => !v)}
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                      ) : (
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <div className="meta-row">
                  <label className="remember-wrap">
                    <span
                      className={`toggle ${rememberMe ? "on" : ""}`}
                      role="checkbox"
                      aria-checked={rememberMe}
                      tabIndex={0}
                      onClick={() => !loading && setRememberMe((v) => !v)}
                      onKeyDown={(e) => {
                        if (e.key === " " || e.key === "Enter") {
                          e.preventDefault();
                          !loading && setRememberMe((v) => !v);
                        }
                      }}
                    >
                      <span className="toggle-knob" />
                    </span>
                    <span className="remember-text">Remember me</span>
                  </label>

                  <button
                    type="button"
                    className="forgot-btn"
                    onClick={() =>
                      toast("Contact admin to reset password", { icon: "🔐" })
                    }
                  >
                    Forgot password?
                  </button>
                </div>

                <button
                  type="submit"
                  className={`submit-btn ${loading ? "loading" : ""}`}
                  disabled={loading}
                >
                  {loading ? (
                    <span className="btn-inner">
                      <svg
                        className="spinner"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                      >
                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                      </svg>
                      Signing In...
                    </span>
                  ) : (
                    <span className="btn-inner">Sign In</span>
                  )}
                </button>
              </form>

              <div className="secure-row">
                <span className="line" />
                <span className="secure-text">Secure Access</span>
                <span className="line" />
              </div>

              <div className="security-card">
                <div className="security-title">
                  🔐 Multi-Warehouse &amp; Custom Permissions
                </div>
                <div className="security-desc">
                  Centralized control with granular role-based access and custom
                  permission matrix per user.
                </div>
              </div>

              <div className="card-footer">
                {"©"} {new Date().getFullYear()} Divine WMS. All rights
                reserved. | Developed by Sr@n
              </div>
            </div>
          </section>

          <section className="hero-panel">
            <div className="hero-copy compact-copy">
              <div className="eyebrow">Enterprise Warehouse Operations</div>
              <h2>Complete Inventory Control From Receiving to Fulfillment</h2>
              <p>
                Manage dual inventory systems with real-time pipelines,
                multi-warehouse coordination, session-based batch operations,
                and enterprise-grade audit compliance.
              </p>
            </div>

            <div className="feature-grid compact-grid">
              {featureItems.map((item) => (
                <div
                  key={item.n}
                  className={`feature-item ${item.active ? "active" : ""}`}
                >
                  <div className="feature-badge">{item.n}</div>
                  <div>
                    <div className="feature-title">{item.title}</div>
                    <div className="feature-desc">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="warehouse-stage compact-stage">
              <div className="stage-grid" />
              <div className="radar radar-1" />
              <div className="radar radar-2" />
              <div className="radar radar-3" />

              <div className="floating-chip chip-stock">
                <span>Session-Based Operations</span>
              </div>
              <div className="floating-chip chip-orders">
                <span>Dual Inventory Systems</span>
              </div>
              <div className="floating-chip chip-accuracy">
                99.8%
                <span>Accuracy Rate</span>
              </div>

              <svg className="route-lines" viewBox="0 0 700 320" fill="none">
                <path d="M70 220 C160 160, 250 162, 332 180 S520 250, 630 190" />
                <path d="M120 120 C220 80, 320 92, 400 126 S520 176, 620 132" />
              </svg>

              <div className="warehouse-core">
                <div className="warehouse-glow" />
                <svg viewBox="0 0 360 280" fill="none">
                  <path d="M70 122L180 66L290 122" className="roof" />
                  <path d="M86 128H274V224H86V128Z" className="building" />
                  <path d="M155 170H205V224H155V170Z" className="door" />
                  <rect
                    x="112"
                    y="146"
                    width="24"
                    height="18"
                    rx="4"
                    className="window"
                  />
                  <rect
                    x="146"
                    y="146"
                    width="24"
                    height="18"
                    rx="4"
                    className="window"
                  />
                  <rect
                    x="190"
                    y="146"
                    width="24"
                    height="18"
                    rx="4"
                    className="window"
                  />
                  <rect
                    x="224"
                    y="146"
                    width="24"
                    height="18"
                    rx="4"
                    className="window"
                  />
                  <path d="M180 66V44" className="flag-line" />
                  <path d="M180 44L208 54L180 66Z" className="flag" />
                </svg>
              </div>

              <div className="crate crate-a">
                <div className="crate-face" />
              </div>
              <div className="crate crate-b">
                <div className="crate-face" />
              </div>
              <div className="crate crate-c">
                <div className="crate-face" />
              </div>

              <div className="scanner scanner-left" />
              <div className="scanner scanner-right" />
            </div>
          </section>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

        *, *::before, *::after {
          box-sizing: border-box;
        }

        html, body {
          margin: 0;
          padding: 0;
          width: 100%;
          min-height: 100%;
          overflow-x: hidden;
          overflow-y: auto;
        }

        body {
          font-family: 'Inter', sans-serif;
          background: #07101f;
        }

        .login-page {
          position: relative;
          width: 100%;
          min-height: 100vh;
          overflow-x: hidden;
          overflow-y: auto;
          font-family: 'Inter', sans-serif;
          color: #fff;
          background: #07101f;
        }

        .bg-layer {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }

        .bg-gradient {
          background:
            radial-gradient(circle at 10% 88%, rgba(23, 87, 182, 0.36), transparent 30%),
            radial-gradient(circle at 70% 8%, rgba(0, 188, 212, 0.08), transparent 22%),
            linear-gradient(135deg, #07101f 0%, #0a1d3e 44%, #08152f 74%, #050d1d 100%);
        }

        .bg-mesh {
          background:
            radial-gradient(circle at 25% 28%, rgba(91, 104, 255, 0.08), transparent 16%),
            radial-gradient(circle at 82% 78%, rgba(0, 188, 255, 0.06), transparent 14%);
          filter: blur(12px);
        }

        .bg-dots {
          background-image: radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px);
          background-size: 24px 24px;
        }

        .bg-rings {
          background:
            radial-gradient(circle at 18% 30%, transparent 0 145px, rgba(255,255,255,0.04) 146px 148px, transparent 149px),
            radial-gradient(circle at 75% 70%, transparent 0 190px, rgba(0,188,212,0.05) 191px 193px, transparent 194px),
            radial-gradient(circle at 52% 82%, transparent 0 160px, rgba(255,255,255,0.03) 161px 163px, transparent 164px);
        }

        .orb {
          position: absolute;
          border-radius: 999px;
          filter: blur(78px);
          pointer-events: none;
        }

        .orb-1 {
          width: 320px;
          height: 320px;
          left: -90px;
          bottom: -110px;
          background: rgba(0, 159, 255, 0.16);
        }

        .orb-2 {
          width: 240px;
          height: 240px;
          right: 18%;
          top: -80px;
          background: rgba(0, 198, 255, 0.08);
        }

        .orb-3 {
          width: 180px;
          height: 180px;
          left: 42%;
          top: 10%;
          background: rgba(61, 75, 255, 0.08);
        }

        .star {
          position: absolute;
          width: 2px;
          height: 2px;
          border-radius: 50%;
          background: rgba(255,255,255,0.65);
          animation: twinkle 2.9s ease-in-out infinite alternate;
          z-index: 0;
        }

        .layout-shell {
          position: relative;
          z-index: 2;
          width: 100%;
          min-height: 100vh;
          display: grid;
          grid-template-columns: minmax(300px, 360px) minmax(0, 1fr);
          gap: clamp(14px, 1.6vw, 24px);
          align-items: center;
          padding: clamp(12px, 1.5vw, 18px);
        }

        .login-panel {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          min-width: 0;
          min-height: 100%;
        }

        .login-card {
          position: relative;
          width: 100%;
          max-width: 360px;
          background: linear-gradient(180deg, rgba(255,255,255,0.985), rgba(247,250,253,0.985));
          color: #0f172a;
          border-radius: 24px;
          border: 1px solid rgba(126, 173, 210, 0.24);
          box-shadow:
            0 18px 46px rgba(0,0,0,0.18),
            0 0 0 1px rgba(255,255,255,0.4) inset;
          padding: 18px 18px 14px;
          overflow: hidden;
          align-self: center;
        }

        .login-card-glow {
          position: absolute;
          inset: 0 0 auto 0;
          height: 88px;
          background: linear-gradient(180deg, rgba(90,198,255,0.07), rgba(90,198,255,0));
          pointer-events: none;
        }

        .mini-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 14px;
        }

        .mini-brand-icon-wrap {
          position: relative;
          width: 46px;
          height: 46px;
          flex-shrink: 0;
        }

        .mini-brand-ring {
          position: absolute;
          inset: -3px;
          border-radius: 50%;
          background: conic-gradient(
            from 0deg,
            rgba(0,188,212,0.52),
            rgba(0,188,212,0.08),
            rgba(0,188,212,0.52)
          );
          animation: spinRing 4s linear infinite;
        }

        .mini-brand-icon {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          background: linear-gradient(135deg, #18396d 0%, #0c2346 100%);
          box-shadow: 0 10px 22px rgba(15, 31, 65, 0.28);
          border-radius: 14px;
          z-index: 1;
        }

        .mini-brand-icon svg {
          width: 21px;
          height: 21px;
        }

        .mini-brand-title {
          font-size: 16px;
          font-weight: 800;
          line-height: 1.05;
        }

        .mini-brand-sub {
          margin-top: 3px;
          font-size: 11.5px;
          color: #64748b;
          font-weight: 500;
        }

        .card-copy {
          margin-bottom: 14px;
        }

        .card-copy h1 {
          margin: 0 0 4px;
          font-size: clamp(28px, 2vw, 34px);
          line-height: 1;
          font-weight: 800;
          letter-spacing: -0.045em;
          color: #111827;
        }

        .card-copy p {
          margin: 0;
          font-size: 10.5px;
          color: #64748b;
          font-weight: 700;
          letter-spacing: 0.18em;
        }

        .form-stack {
          display: flex;
          flex-direction: column;
          gap: 11px;
        }

        .field-block label {
          display: block;
          margin-bottom: 6px;
          font-size: 12px;
          font-weight: 700;
          color: #5f6f83;
        }

        .input-wrap {
          position: relative;
          border-radius: 13px;
        }

        .input-wrap input {
          width: 100%;
          height: 46px;
          border: 1.5px solid #d7e5ef;
          border-radius: 13px;
          padding: 0 40px 0 14px;
          font-size: 13.5px;
          font-family: 'Inter', sans-serif;
          color: #0f172a;
          background: #f8fbfd;
          outline: none;
          transition: border-color 180ms ease, box-shadow 180ms ease, background 180ms ease;
        }

        .input-wrap input::placeholder {
          color: #9fb0bf;
        }

        .input-wrap.is-focused input,
        .input-wrap input:focus {
          border-color: #1ea5dd;
          background: #fff;
          box-shadow: 0 0 0 4px rgba(30,165,221,0.10);
        }

        .input-ok {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #10b981;
          display: flex;
        }

        .input-ok svg,
        .eye-btn svg {
          width: 16px;
          height: 16px;
        }

        .eye-btn {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          border: none;
          background: transparent;
          padding: 4px;
          color: #7c8ca0;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .meta-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-top: 1px;
        }

        .remember-wrap {
          display: flex;
          align-items: center;
          gap: 7px;
          user-select: none;
        }

        .toggle {
          width: 34px;
          height: 20px;
          border-radius: 999px;
          background: #d4e1ea;
          position: relative;
          cursor: pointer;
          transition: background 180ms ease;
          flex-shrink: 0;
        }

        .toggle-knob {
          position: absolute;
          width: 14px;
          height: 14px;
          left: 3px;
          top: 3px;
          border-radius: 50%;
          background: #fff;
          box-shadow: 0 1px 4px rgba(0,0,0,0.2);
          transition: left 180ms ease;
        }

        .toggle.on {
          background: linear-gradient(135deg, #34b4e8 0%, #2a7fd5 100%);
        }

        .toggle.on .toggle-knob {
          left: 17px;
        }

        .remember-text,
        .forgot-btn {
          font-size: 12px;
          font-weight: 600;
        }

        .remember-text {
          color: #64748b;
        }

        .forgot-btn {
          background: transparent;
          border: none;
          padding: 0;
          color: #1e9dcc;
          cursor: pointer;
        }

        .submit-btn {
          margin-top: 2px;
          width: 100%;
          height: 48px;
          border: none;
          border-radius: 14px;
          background: linear-gradient(135deg, #67c8ef 0%, #2698d1 55%, #2577c7 100%);
          color: #fff;
          font-size: 14px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          cursor: pointer;
          box-shadow: 0 12px 24px rgba(38, 152, 209, 0.24);
          transition: transform 180ms ease, box-shadow 180ms ease;
        }

        .submit-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 14px 28px rgba(38, 152, 209, 0.28);
        }

        .submit-btn.loading,
        .submit-btn:disabled {
          background: #dfe8ef;
          color: #8b9bab;
          box-shadow: none;
          cursor: not-allowed;
        }

        .btn-inner {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .spinner {
          width: 16px;
          height: 16px;
          animation: spin 0.9s linear infinite;
        }

        .secure-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 12px 0 10px;
        }

        .secure-row .line {
          flex: 1;
          height: 1px;
          background: #e2edf3;
        }

        .secure-text {
          font-size: 11px;
          color: #94a3b8;
          font-weight: 700;
        }

        .security-card {
          border-radius: 14px;
          padding: 11px 12px;
          background: linear-gradient(
            135deg,
            rgba(84, 195, 241, 0.08),
            rgba(84, 195, 241, 0.03)
          );
          border: 1px solid rgba(30, 165, 221, 0.15);
          text-align: center;
        }

        .security-title {
          font-size: 11px;
          color: #1ea5dd;
          font-weight: 800;
          letter-spacing: 0.04em;
          margin-bottom: 3px;
        }

        .security-desc {
          font-size: 11px;
          color: #66778b;
          font-weight: 500;
        }

        .card-footer {
          margin-top: 10px;
          font-size: 10.2px;
          color: #94a3b8;
          line-height: 1.4;
          text-align: center;
        }

        .hero-panel {
          min-width: 0;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 4px 0;
          gap: 14px;
          min-height: 100%;
        }

        .compact-copy {
          max-width: 760px;
        }

        .eyebrow {
          display: inline-flex;
          align-items: center;
          padding: 7px 11px;
          border-radius: 999px;
          background: rgba(85,198,255,0.08);
          border: 1px solid rgba(85,198,255,0.14);
          color: #79d6ff;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin-bottom: 10px;
        }

        .hero-copy h2 {
          margin: 0;
          max-width: 840px;
          font-size: clamp(30px, 3.7vw, 54px);
          line-height: 0.98;
          font-weight: 800;
          letter-spacing: -0.05em;
        }

        .hero-copy p {
          margin: 10px 0 0;
          max-width: 700px;
          font-size: clamp(13px, 1.15vw, 17px);
          line-height: 1.5;
          color: rgba(255,255,255,0.68);
          font-weight: 500;
        }

        .compact-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 12px;
          max-width: 980px;
        }

        .feature-item {
          display: flex;
          gap: 10px;
          align-items: flex-start;
          padding: 13px 14px;
          border-radius: 18px;
          background: linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.015));
          border: 1px solid rgba(255,255,255,0.08);
          backdrop-filter: blur(10px);
          min-height: 94px;
        }

        .feature-item.active {
          border-color: rgba(94, 213, 255, 0.24);
          background: linear-gradient(135deg, rgba(85,198,255,0.11), rgba(255,255,255,0.02));
        }

        .feature-badge {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 13px;
          color: #fff;
          background: linear-gradient(135deg, #40c9f6, #1688d7);
          box-shadow: 0 6px 16px rgba(35, 154, 213, 0.28);
        }

        .feature-title {
          font-size: 14px;
          font-weight: 700;
          color: #fff;
          line-height: 1.3;
          margin-bottom: 4px;
        }

        .feature-desc {
          font-size: 12px;
          line-height: 1.45;
          color: rgba(255,255,255,0.62);
        }

        .compact-stage {
          position: relative;
          flex: 1;
          min-height: 210px;
          border-radius: 24px;
          background: linear-gradient(180deg, rgba(7,18,38,0.14), rgba(7,18,38,0.03));
          overflow: hidden;
        }

        .stage-grid {
          position: absolute;
          inset: 0;
          background:
            linear-gradient(rgba(83, 200, 240, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(83, 200, 240, 0.05) 1px, transparent 1px);
          background-size: 28px 28px;
          mask-image: linear-gradient(to bottom, rgba(0,0,0,0.8), transparent 94%);
        }

        .radar {
          position: absolute;
          border-radius: 50%;
          border: 1px solid rgba(87, 211, 255, 0.13);
          animation: pulseRing 5s ease-in-out infinite;
        }

        .radar-1 {
          width: 180px;
          height: 180px;
          left: 47%;
          top: 54%;
          transform: translate(-50%, -50%);
        }

        .radar-2 {
          width: 250px;
          height: 250px;
          left: 47%;
          top: 54%;
          transform: translate(-50%, -50%);
          animation-delay: 1s;
        }

        .radar-3 {
          width: 320px;
          height: 320px;
          left: 47%;
          top: 54%;
          transform: translate(-50%, -50%);
          animation-delay: 2s;
        }

        .route-lines {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
        }

        .route-lines path {
          stroke: rgba(86, 206, 255, 0.18);
          stroke-width: 2;
          stroke-linecap: round;
          stroke-dasharray: 8 10;
          animation: dashMove 10s linear infinite;
        }

        .warehouse-core {
          position: absolute;
          left: 47%;
          top: 57%;
          width: min(28vw, 250px);
          transform: translate(-50%, -50%);
          z-index: 2;
          animation: floatCore 5.2s ease-in-out infinite;
        }

        .warehouse-glow {
          position: absolute;
          inset: 18% 18% 10% 18%;
          background: radial-gradient(circle, rgba(48, 196, 255, 0.2), transparent 70%);
          filter: blur(18px);
        }

        .warehouse-core svg {
          width: 100%;
          height: auto;
          position: relative;
          z-index: 1;
        }

        .warehouse-core .roof {
          stroke: rgba(92, 220, 255, 0.76);
          stroke-width: 4;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .warehouse-core .building {
          fill: rgba(30, 132, 196, 0.14);
          stroke: rgba(92, 220, 255, 0.44);
          stroke-width: 3;
        }

        .warehouse-core .door {
          fill: rgba(30, 176, 216, 0.16);
          stroke: rgba(92, 220, 255, 0.42);
          stroke-width: 2.4;
        }

        .warehouse-core .window {
          fill: rgba(61, 214, 255, 0.16);
          stroke: rgba(92, 220, 255, 0.38);
          stroke-width: 2;
        }

        .warehouse-core .flag-line {
          stroke: rgba(255,255,255,0.36);
          stroke-width: 2;
        }

        .warehouse-core .flag {
          fill: rgba(67, 213, 255, 0.78);
        }

        .floating-chip {
          position: absolute;
          display: flex;
          flex-direction: column;
          gap: 1px;
          padding: 9px 11px;
          border-radius: 14px;
          background: linear-gradient(135deg, rgba(10,30,60,0.72), rgba(15,40,74,0.46));
          border: 1px solid rgba(85,198,255,0.18);
          color: #57d2ff;
          font-size: 18px;
          font-weight: 800;
          letter-spacing: -0.03em;
          backdrop-filter: blur(10px);
          animation: floatChip 6s ease-in-out infinite;
          z-index: 3;
        }

        .floating-chip span {
          font-size: 9.5px;
          color: rgba(255,255,255,0.65);
          font-weight: 600;
          text-transform: uppercase;
        }

        .chip-stock {
          left: 8%;
          top: 14%;
        }

        .chip-orders {
          left: 16%;
          bottom: 10%;
          animation-delay: 1.4s;
        }

        .chip-accuracy {
          right: 8%;
          top: 12%;
          animation-delay: 0.8s;
        }

        .crate {
          position: absolute;
          width: 36px;
          height: 28px;
          border-radius: 9px;
          border: 1px solid rgba(91, 214, 255, 0.24);
          background: rgba(11, 28, 56, 0.42);
          z-index: 2;
          animation: floatCrate 5s ease-in-out infinite;
        }

        .crate-face {
          position: absolute;
          inset: 5px;
          border-radius: 5px;
          background: linear-gradient(135deg, rgba(57,205,240,0.22), rgba(57,205,240,0.05));
          border: 1px solid rgba(57,205,240,0.20);
        }

        .crate-a {
          left: 24%;
          top: 62%;
        }

        .crate-b {
          left: 38%;
          top: 26%;
          animation-delay: 1.2s;
        }

        .crate-c {
          right: 21%;
          top: 58%;
          animation-delay: 2s;
        }

        .scanner {
          position: absolute;
          width: 2px;
          height: 92px;
          background: linear-gradient(180deg, transparent, rgba(79,213,255,0.8), transparent);
          box-shadow: 0 0 14px rgba(79,213,255,0.42);
          animation: scanMove 3.8s ease-in-out infinite;
          z-index: 1;
        }

        .scanner-left {
          left: 33%;
          top: 34%;
        }

        .scanner-right {
          right: 31%;
          top: 28%;
          animation-delay: 1.4s;
        }

        @keyframes twinkle {
          0% {
            opacity: 0.2;
            transform: scale(1);
          }
          100% {
            opacity: 0.8;
            transform: scale(1.5);
          }
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes spinRing {
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes pulseRing {
          0%, 100% {
            opacity: 0.22;
            transform: translate(-50%, -50%) scale(1);
          }
          50% {
            opacity: 0.55;
            transform: translate(-50%, -50%) scale(1.025);
          }
        }

        @keyframes dashMove {
          to {
            stroke-dashoffset: -120;
          }
        }

        @keyframes floatCore {
          0%, 100% {
            transform: translate(-50%, -50%) translateY(0);
          }
          50% {
            transform: translate(-50%, -50%) translateY(-8px);
          }
        }

        @keyframes floatChip {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-7px);
          }
        }

        @keyframes floatCrate {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-6px);
          }
        }

        @keyframes scanMove {
          0%, 100% {
            opacity: 0.18;
            transform: translateY(-4px);
          }
          50% {
            opacity: 0.95;
            transform: translateY(6px);
          }
        }

        @media (max-width: 1280px) {
          .layout-shell {
            grid-template-columns: minmax(290px, 340px) minmax(0, 1fr);
          }

          .hero-copy h2 {
            font-size: clamp(28px, 3.4vw, 46px);
          }

          .compact-grid {
            gap: 10px;
          }

          .feature-item {
            min-height: 88px;
          }

          .warehouse-core {
            width: min(26vw, 220px);
          }
        }

        @media (max-width: 1080px) {
          .layout-shell {
            grid-template-columns: minmax(280px, 320px) minmax(0, 1fr);
            gap: 12px;
          }

          .hero-copy h2 {
            font-size: clamp(26px, 3.2vw, 40px);
          }

          .hero-copy p {
            font-size: 13px;
          }

          .compact-stage {
            min-height: 190px;
          }
        }

        @media (max-width: 900px) {
          .layout-shell {
            grid-template-columns: 1fr;
            grid-template-rows: auto auto;
            min-height: auto;
            gap: 12px;
            padding: 12px;
            align-items: start;
          }

          .login-panel {
            justify-content: center;
          }

          .login-card {
            max-width: 440px;
          }

          .hero-panel {
            gap: 12px;
            justify-content: flex-start;
          }

          .compact-grid {
            grid-template-columns: 1fr;
          }

          .compact-stage {
            min-height: 220px;
          }

          .warehouse-core {
            width: min(52vw, 220px);
          }
        }

        @media (max-width: 640px) {
          .login-page {
            min-height: 100vh;
          }

          .layout-shell {
            min-height: auto;
          }

          .login-card {
            max-width: 100%;
            border-radius: 22px;
          }

          .card-copy h1 {
            font-size: 26px;
          }

          .meta-row {
            flex-direction: column;
            align-items: flex-start;
          }

          .hero-copy h2 {
            font-size: 26px;
            line-height: 1.05;
          }

          .compact-stage {
            min-height: 210px;
          }

          .floating-chip {
            font-size: 15px;
          }
        }

        @media (max-height: 820px) {
          .login-page {
            overflow-y: auto;
          }

          .layout-shell {
            min-height: auto;
            align-items: start;
            padding-top: 16px;
            padding-bottom: 16px;
          }

          .hero-panel {
            justify-content: flex-start;
          }

          .login-card {
            align-self: start;
          }

          .compact-stage {
            min-height: 180px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
    </>
  );
}
