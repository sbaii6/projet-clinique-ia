# Système d'Orientation Clinique Intelligent (Multi-Agents)

## 📌 Contexte du Projet
[cite_start]Ce projet consiste en le développement d'une application web d'orientation clinique préliminaire[cite: 7, 8]. [cite_start]Il implémente une architecture multi-agents basée sur **LangGraph** pour modéliser et simuler le parcours de prise en charge d'un patient[cite: 7]. 
*⚠️ Ce système est un exercice strictement académique et ne fournit pas de diagnostic médical définitif. Toute recommandation intermédiaire doit être validée et signée par un médecin traitant[cite: 11, 12, 13, 14].*

## [cite_start]🛠️ Architecture et Technologies [cite: 3]
* [cite_start]**Frontend :** React.js (Interface utilisateur style SaaS, Gestion de l'historique via LocalStorage)[cite: 22, 65].
* [cite_start]**Backend :** FastAPI (Exposition et documentation des routes REST)[cite: 20, 63].
* [cite_start]**Moteur IA :** LangGraph & LangChain (Orchestration du graphe et gestion de l'état partagé)[cite: 17, 18, 62].
* [cite_start]**Modèle LLM :** Llama 3.3 (via l'API Groq)[cite: 62].
* [cite_start]**Outils Externes :** Serveur MCP (Model Context Protocol) pour l'intégration des directives et règles cliniques[cite: 21, 64].

## 🚀 Procédure de Lancement (Windows PowerShell)

### [cite_start]1. Démarrer le Backend (FastAPI) [cite: 63]
Ouvre un premier terminal PowerShell et exécute les commandes suivantes :
```bash
cd backend
.venv\Scripts\activate
$env:PYTHONPATH="backend"
python -m uvicorn app.api:app --reload