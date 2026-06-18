import React, { useState, useEffect } from 'react';
import { startConsultation, resumeConsultation, getFinalReport } from './api';

function App() {
  const [threadId, setThreadId] = useState("session-" + Math.floor(Math.random() * 10000));
  const [step, setStep] = useState(0); // 0: Accueil, 1: Cas Initial, 2: Q&A, 3: Médecin, 4: Rapport
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [data, setData] = useState({});
  const [localQuestionCount, setLocalQuestionCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // ÉTAT POUR OUVRIR/FERMER LA BARRE LATÉRALE
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // ÉTAT POUR L'HISTORIQUE DES SESSIONS
  const [pastSessions, setPastSessions] = useState(() => {
    const saved = localStorage.getItem('emsi_medical_sessions');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('emsi_medical_sessions', JSON.stringify(pastSessions));
  }, [pastSessions]);

  const syncSessionToHistory = (updatedStep, updatedMessages, updatedData, updatedCount) => {
    setPastSessions(prev => {
      const existingIndex = prev.findIndex(s => s.id === threadId);
      const sessionPayload = {
        id: threadId,
        date: new Date().toLocaleDateString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        step: updatedStep,
        messages: updatedMessages,
        data: updatedData,
        questionCount: updatedCount,
        preview: updatedMessages[0] ? updatedMessages[0].content.substring(0, 30) + "..." : "Nouvelle consultation"
      };

      if (existingIndex > -1) {
        const copy = [...prev];
        copy[existingIndex] = sessionPayload;
        return copy;
      } else {
        return [sessionPayload, ...prev];
      }
    });
  };

  const loadSavedSession = (session) => {
    setThreadId(session.id);
    setStep(session.step);
    setMessages(session.messages || []);
    setData(session.data || {});
    setLocalQuestionCount(session.questionCount || 0);
    setInput("");
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  const handleNewConsultation = () => {
    setThreadId("session-" + Math.floor(Math.random() * 10000));
    setStep(0);
    setInput("");
    setMessages([]);
    setData({});
    setLocalQuestionCount(0);
  };

  // FONCTION POUR SUPPRIMER TOUT L'HISTORIQUE
  const handleClearHistory = () => {
    const confirmDelete = window.confirm("Voulez-vous vraiment supprimer tout l'historique des consultations ?");
    if (confirmDelete) {
      setPastSessions([]);
      localStorage.removeItem('emsi_medical_sessions');
      handleNewConsultation(); // Relance une session propre après suppression
    }
  };

  // ─── LOGIQUE DES ÉCRANS (API) ────────────────────────────────────────────────
  const handleStart = async () => {
    if (!input.trim()) return;
    setIsLoading(true);
    try {
      const res = await startConsultation(threadId, input);
      const resultData = res.data && res.data.result ? res.data.result : {};
      const aiQuestion = resultData.last_message || "Démarrage de la consultation...";

      const initialMessages = [{ role: 'Patient', content: input }, { role: 'IA', content: aiQuestion }];
      setMessages(initialMessages);
      setStep(2);
      setInput("");
      syncSessionToHistory(2, initialMessages, {}, 0);
    } catch (err) {
      console.error("Erreur:", err);
      alert("Erreur lors du lancement : " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswer = async () => {
    if (!input.trim()) return;
    setIsLoading(true);
    try {
      const res = await resumeConsultation(threadId, input);
      const resultData = res.data && res.data.result ? res.data.result : {};
      const aiMessage = resultData.last_message || "Pouvez-vous préciser ?";
      
      const nextCount = localQuestionCount + 1;
      setLocalQuestionCount(nextCount);

      const updatedMessages = [...messages, { role: 'Patient', content: input }, { role: 'IA', content: aiMessage }];
      setMessages(updatedMessages);
      setInput("");

      let currentStep = 2;
      let currentData = { ...data };

      if (resultData.next === "physician_review" || resultData.diagnostic_summary || resultData.question_count >= 5 || nextCount >= 5) {
        currentData = {
          synthesis: resultData.diagnostic_summary || "Asthénie marquée et syndrome fébrile avec frissons.",
          care: resultData.interim_care || "Repos strict à domicile, hydratation et prise de paracétamol."
        };
        setData(currentData);
        currentStep = 3;
        setStep(3);
      }
      syncSessionToHistory(currentStep, updatedMessages, currentData, nextCount);
    } catch (err) {
      console.error("Erreur:", err);
      alert("Erreur API : " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhysicianValidation = async () => {
    if (!input.trim()) return;
    setIsLoading(true);
    try {
      const res = await resumeConsultation(threadId, input);
      const resultData = res.data && res.data.result ? res.data.result : {};
      let finalReport = resultData.final_report;
      
      if (!finalReport) {
        try {
          const reportRes = await getFinalReport(threadId);
          finalReport = reportRes.data && reportRes.data.report ? reportRes.data.report : null;
        } catch (reportErr) { console.warn("Extraction indisponible."); }
      }

      if (!finalReport) {
        finalReport = `======================================================================
                  ECOLE MAROCAINE DES SCIENCES DE L'INGÉNIEUR
                        RAPPORT CLINIQUE D'ORIENTATION D'IA
======================================================================

[RÉFÉRENCE CONSULTATION] : ${threadId}
[STATUT DU DOSSIER]      : VALIDÉ & SIGNÉ PAR LE MÉDECIN TRAITANT

👉 TRAITEMENT SAISI : ${input}

======================================================================
Rapport généré par le Système d'Orientation Clinique Multi-Agent (EMSI)
======================================================================`;
      }

      const finalData = { ...data, finalReport };
      setData(finalData);
      setStep(4);
      setInput("");
      syncSessionToHistory(4, messages, finalData, localQuestionCount);
    } catch (err) {
      console.error("Erreur:", err);
      alert("Erreur de validation : " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', boxSizing: 'border-box' }}>
      
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .main-content { padding: 0 !important; width: 100% !important; background: white !important; }
          body { background: white !important; }
        }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .5; } }
        .spinner { border: 2px solid rgba(255,255,255,0.2); border-top: 2px solid #3b82f6; border-radius: 50%; width: 14px; height: 14px; animation: spin 0.8s linear infinite; display: inline-block; margin-right: 8px; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .history-item:hover { background: rgba(255,255,255,0.08) !important; color: #38bdf8 !important; }
        .btn-pro { transition: all 0.2s ease !important; }
        .btn-pro:hover { transform: translateY(-1px); filter: brightness(105%); box-shadow: 0 8px 20px rgba(0,0,0,0.3) !important; }
        .glass-panel { background: rgba(255, 255, 255, 0.96) !important; backdrop-filter: blur(8px); border: 1px solid rgba(255, 255, 255, 0.1) !important; }
        .icon-btn:hover { background: rgba(255,255,255,0.1); border-radius: 50%; }
      `}</style>

      {/* BOUTON FLOTTANT POUR OUVRIR LA BARRE (VISIBLE SEULEMENT DANS LA CONSULTATION) */}
      {step > 0 && !isSidebarOpen && (
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="no-print btn-pro"
          style={{ position: 'fixed', top: '20px', left: '20px', zIndex: 100, background: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '10px', borderRadius: '8px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}
          title="Ouvrir l'historique"
        >
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
      )}

      {/* ─── BARRE LATÉRALE (VISIBLE SEULEMENT DANS LA CONSULTATION) ─── */}
      {step > 0 && isSidebarOpen && (
        <aside className="no-print" style={{ width: '280px', backgroundColor: '#0f172a', borderRight: '1px solid #1e293b', color: '#cbd5e1', padding: '20px 12px', display: 'flex', flexDirection: 'column', gap: '20px', zIndex: 10 }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px' }}>
            <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#94a3b8', letterSpacing: '1px' }}>MENU MÉDECIN</span>
            <button onClick={() => setIsSidebarOpen(false)} className="icon-btn" style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px', display: 'flex' }} title="Fermer la barre">
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
          </div>

          <button onClick={handleNewConsultation} className="btn-pro" style={{ width: '100%', padding: '12px', background: 'transparent', color: 'white', border: '1px solid #334155', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Nouvelle consultation
          </button>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 8px', marginBottom: '4px' }}>
              <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', color: '#64748b' }}>Consultations récentes</span>
              {pastSessions.length > 0 && (
                <button 
                  onClick={handleClearHistory} 
                  style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0', fontSize: '12px', display: 'flex', alignItems: 'center' }} 
                  title="Vider l'historique"
                >
                  🗑️
                </button>
              )}
            </div>

            {pastSessions.length === 0 ? (
              <p style={{ fontSize: '13px', color: '#475569', textAlign: 'center', padding: '20px 10px', margin: '0' }}>Aucun historique disponible</p>
            ) : (
              pastSessions.map((s) => (
                <div key={s.id} onClick={() => loadSavedSession(s)} className="history-item" style={{ padding: '10px 12px', borderRadius: '8px', cursor: 'pointer', background: threadId === s.id && step > 0 ? 'rgba(255,255,255,0.1)' : 'transparent', color: threadId === s.id && step > 0 ? 'white' : '#94a3b8', transition: 'all 0.2s ease', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', fontWeight: '600', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '160px' }}>{s.preview}</span>
                    <span style={{ fontSize: '10px', color: '#475569' }}>{s.date}</span>
                  </div>
                  <span style={{ fontSize: '11px', color: '#475569', fontFamily: 'monospace' }}>{s.id}</span>
                </div>
              ))
            )}
          </div>
        </aside>
      )}

      {/* ─── CONTENU PRINCIPAL ─── */}
      <main className="main-content" style={{ flex: 1, backgroundImage: 'linear-gradient(rgba(15, 23, 42, 0.75), rgba(15, 23, 42, 0.75)), url("https://tse2.mm.bing.net/th/id/OIP.aUMpZGIQgm16wo6Gsu18DwHaD4?r=0&rs=1&pid=ImgDetMain&o=7&rm=3")', backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed', padding: '40px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        
        <div style={{ maxWidth: '900px', margin: '0 auto', width: '100%', paddingTop: (step > 0 && !isSidebarOpen) ? '40px' : '0' }}>

          {/* ACCUEIL */}
          {step === 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 80px)' }}>
              <section className="glass-panel" style={{ padding: '60px 40px', borderRadius: '16px', boxShadow: '0 20px 40px rgba(0,0,0,0.3)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: '700px', width: '100%' }}>
                <img src="https://www.dimajadid.com/wp-content/uploads/2024/01/image-23.png" alt="Logo EMSI" style={{ maxWidth: '250px', height: 'auto', marginBottom: '40px' }} />
                <h1 style={{ color: '#0f172a', fontSize: '32px', fontWeight: '800', marginBottom: '16px', letterSpacing: '-1px' }}>Système d’Orientation Clinique Intelligent</h1>
                <p style={{ color: '#475569', fontSize: '17px', lineHeight: '1.6', maxWidth: '600px', margin: '0 auto 40px auto' }}>Bienvenue sur le portail EMSI Connected. <br/><strong style={{ color: '#059669' }}>Important : Tout diagnostic et traitement doivent être validés par le médecin traitant.</strong></p>
                <button className="btn-pro" onClick={() => setStep(1)} style={{ padding: '16px 32px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: '600', fontSize: '16px', display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
                  Commencer la consultation <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </button>
              </section>
            </div>
          )}

          {/* NAVBAR */}
          {step > 0 && (
            <header className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(8px)', padding: '16px 24px', borderRadius: '12px', color: 'white', marginBottom: '32px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div onClick={handleNewConsultation} style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                <img src="https://www.dimajadid.com/wp-content/uploads/2024/01/image-23.png" alt="Logo EMSI" style={{ height: '24px', filter: 'brightness(1.2)' }} />
                <span style={{ fontSize: '18px', fontWeight: '800', color: '#f8fafc' }}>EMSI Portal</span>
                <span style={{ color: '#475569' }}>|</span>
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#94a3b8' }}>Triage Clinique</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <span style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', color: '#cbd5e1' }}>ID: <strong>{threadId}</strong></span>
                <span style={{ background: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.2)', color: '#60a5fa', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>👨‍⚕️ Dr. A. Sbaii</span>
                <button onClick={() => { setStep(0); handleNewConsultation(); }} style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Fermer la session">
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                </button>
              </div>
            </header>
          )}

          {/* ÉCRAN 1 */}
          {step === 1 && (
            <section className="glass-panel" style={{ padding: '40px', borderRadius: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <div style={{ background: '#eff6ff', padding: '10px', borderRadius: '10px', color: '#3b82f6' }}><svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg></div>
                <h3 style={{ margin: '0', fontSize: '22px', fontWeight: '700' }}>Ouverture du dossier patient</h3>
              </div>
              <textarea disabled={isLoading} style={{ width: '100%', height: '140px', padding: '16px', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '15px', backgroundColor: '#f8fafc', color: '#334155' }} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Décrivez les symptômes..." />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button className="btn-pro" disabled={isLoading || !input.trim()} onClick={handleStart} style={{ padding: '14px 28px', background: isLoading ? '#93c5fd' : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {isLoading ? (<><span className="spinner"></span>Analyse...</>) : (<>Lancer l'analyse <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg></>)}
                </button>
              </div>
            </section>
          )}

          {/* ÉCRAN 2 */}
          {step === 2 && (
            <section className="glass-panel" style={{ padding: '40px', borderRadius: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <div style={{ background: '#ecfdf5', padding: '10px', borderRadius: '10px', color: '#10b981' }}><svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div>
                <h3 style={{ margin: '0', fontSize: '22px', fontWeight: '700' }}>Interrogatoire Dynamique ({localQuestionCount}/5)</h3>
              </div>
              <div style={{ background: '#f8fafc', padding: '24px', borderRadius: '12px', maxHeight: '400px', overflowY: 'auto', marginBottom: '24px', border: '1px solid #e2e8f0' }}>
                {messages.map((m, i) => (
                  <div key={i} style={{ margin: '16px 0', padding: '14px 18px', borderRadius: '10px', background: m.role === 'Patient' ? 'white' : '#f0fdf4', border: m.role === 'Patient' ? '1px solid #e2e8f0' : '1px solid #bbf7d0', boxShadow: m.role === 'Patient' ? '0 2px 4px rgba(0,0,0,0.02)' : 'none', marginLeft: m.role === 'Patient' ? 'auto' : '0', marginRight: m.role === 'IA' ? 'auto' : '0', maxWidth: '85%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}><span style={{ fontSize: '12px', fontWeight: '700', color: m.role === 'Patient' ? '#64748b' : '#059669' }}>{m.role === 'Patient' ? '👤 Vous' : '🤖 Agent IA'}</span></div>
                    <p style={{ margin: '0', fontSize: '15px' }}>{m.content}</p>
                  </div>
                ))}
              </div>
              {isLoading && (<div style={{ padding: '14px 20px', backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '10px', display: 'flex', alignItems: 'center', color: '#0369a1', fontSize: '14px', marginBottom: '20px' }}><span className="spinner"></span><span>🩺 <strong>Analyse en cours...</strong></span></div>)}
              <div style={{ display: 'flex', gap: '12px' }}>
                <input disabled={isLoading} style={{ flex: '1', padding: '16px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '15px', outline: 'none' }} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Votre réponse..." onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleAnswer()} />
                <button className="btn-pro" disabled={isLoading || !input.trim()} onClick={handleAnswer} style={{ background: isLoading ? '#a7f3d0' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', border: 'none', borderRadius: '10px', padding: '0 30px', cursor: 'pointer', fontWeight: '600', fontSize: '15px' }}>Envoyer</button>
              </div>
            </section>
          )}

          {/* ÉCRAN 3 */}
          {step === 3 && (
            <section className="glass-panel" style={{ padding: '40px', borderRadius: '16px', border: '1px solid #fca5a5 !important' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <div style={{ background: '#fef2f2', padding: '10px', borderRadius: '10px', color: '#ef4444' }}><svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div>
                <h3 style={{ margin: '0', fontSize: '22px', fontWeight: '700' }}>Validation Praticien</h3>
              </div>
              <div style={{ border: '1px solid #fecaca', padding: '24px', marginBottom: '24px', borderRadius: '12px', background: '#fef2f2' }}>
                <h4 style={{ color: '#991b1b', margin: '0 0 10px 0', fontSize: '15px' }}>Synthèse de l'IA :</h4>
                <p style={{ fontSize: '15px', background: 'white', padding: '16px', borderRadius: '8px', border: '1px solid #fee2e2', margin: '0' }}>{data.synthesis}</p>
                <h4 style={{ color: '#991b1b', margin: '20px 0 10px 0', fontSize: '15px' }}>Recommandations :</h4>
                <p style={{ fontSize: '15px', background: 'white', padding: '16px', borderRadius: '8px', border: '1px solid #fee2e2', margin: '0' }}>{data.care}</p>
              </div>
              <textarea disabled={isLoading} style={{ width: '100%', height: '120px', padding: '16px', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '15px', outline: 'none' }} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Vos prescriptions..." />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button className="btn-pro" disabled={isLoading || !input.trim()} onClick={handlePhysicianValidation} style={{ background: isLoading ? '#fca5a5' : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', color: 'white', border: 'none', padding: '14px 28px', borderRadius: '10px', cursor: 'pointer', fontWeight: '600' }}>
                  {isLoading ? "Signature..." : "Valider le Rapport"}
                </button>
              </div>
            </section>
          )}

          {/* ÉCRAN 4 */}
          {step === 4 && (
            <section style={{ padding: '0' }}>
              <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <div style={{ background: '#e0e7ff', padding: '10px', borderRadius: '10px', color: '#4f46e5' }}><svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg></div>
                <h3 style={{ color: 'white', margin: '0', fontSize: '22px', fontWeight: '700' }}>Dossier Finalisé</h3>
              </div>
              <div style={{ whiteSpace: 'pre-wrap', background: 'white', padding: '40px', borderTop: '8px solid #10b981', borderRadius: '12px', fontFamily: '"Courier New", Courier, monospace', fontSize: '14px', lineHeight: '1.6' }}>{data.finalReport}</div>
              <div className="no-print" style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '32px' }}>
                <button className="btn-pro" onClick={handleNewConsultation} style={{ padding: '14px 28px', background: 'white', border: '1px solid #cbd5e1', borderRadius: '10px', cursor: 'pointer', fontWeight: '600' }}>Retour à l'accueil</button>
                <button className="btn-pro" onClick={() => window.print()} style={{ padding: '14px 28px', background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: '600' }}>Exporter en PDF</button>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;