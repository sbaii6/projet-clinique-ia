#  Système d'Orientation Clinique Intelligent (Multi-Agents)

**Projet académique – École Marocaine des Sciences de l'Ingénieur (EMSI) – 4IIR**

**Encadrant :** Pr. Mohamed YOUSSFI  
**Réalisé par :** Abderrahmane Sbaii

---

#  Présentation du Projet

Ce projet consiste à développer une plateforme web intelligente d'orientation clinique préliminaire basée sur une architecture **Multi-Agents**.

Le système utilise **LangGraph** pour orchestrer plusieurs agents IA spécialisés afin de simuler un workflow médical sécurisé.

L'objectif est de permettre :

- La collecte des symptômes du patient.
- L'analyse conversationnelle par un agent IA.
- La génération d'une synthèse clinique préliminaire.
- La validation obligatoire par un médecin.
- La génération d'un rapport médical final.

 **Important :**

Ce projet est réalisé dans un cadre académique uniquement.

L'intelligence artificielle ne fournit pas de diagnostic médical définitif.
Toute recommandation doit être contrôlée et validée par un professionnel de santé.

---

#  Objectifs

Les objectifs principaux sont :

- Mettre en place une architecture Multi-Agents.
- Comprendre l'orchestration avec LangGraph.
- Utiliser un LLM dans un workflow contrôlé.
- Implémenter un mécanisme Human-in-the-Loop.
- Séparer les connaissances médicales grâce à MCP.
- Générer automatiquement un rapport structuré.

---

#  Architecture du Système

Le système est basé sur un graphe d'état **LangGraph StateGraph**.

Le flux réel de l'application :

```text
                 Patient / Médecin
                        │
                        ▼
                 Interface React
                        │
                        ▼
                  FastAPI Backend
                        │
                        ▼
                 MedicalState
                        │
                        ▼
                ┌─────────────┐
                │ Supervisor  │
                └──────┬──────┘
                       │
                       ▼
            ┌────────────────────┐
            │ Diagnostic Agent   │
            └────────┬───────────┘
                     │
                     ▼
              Questions médicales
                     │
                     ▼
              Synthèse clinique IA
                     │
                     ▼
          ┌──────────────────────┐
          │ Physician Review      │
          │ Human-in-the-Loop    │
          └──────────┬───────────┘
                     │
                     ▼
             Validation médecin
                     │
                     ▼
             ┌──────────────┐
             │ Report Agent │
             └──────┬───────┘
                    │
                    ▼
             Rapport final PDF

```

---

#  Agents IA

## 1. Supervisor Agent

Le Supervisor est le contrôleur principal du graphe.

Son rôle :

- Recevoir l'état courant.
- Choisir l'agent suivant.
- Contrôler les transitions.
- Superviser l'exécution complète.

Il permet de gérer le workflow entre :

- Diagnostic Agent
- Physician Review
- Report Agent


---

## 2. Diagnostic Agent

Fichier :

```
backend/app/nodes/diagnostic_agent.py
```

Cet agent utilise un modèle LLM (**Llama 3.3 via Groq API**).

Fonctions :

- Interagir avec le patient.
- Collecter les symptômes.
- Poser 5 questions ciblées.
- Analyser les réponses.
- Générer une synthèse clinique préliminaire.

Exemples de recommandations :

- Repos
- Hydratation
- Surveillance des symptômes


⚠️ Aucun diagnostic médical automatique n'est produit.

---

## 3. Physician Review Agent

Fichier :

```
backend/app/nodes/physician_review.py
```

Cette étape représente l'intervention humaine.

Le workflow est interrompu grâce à LangGraph :

```python
interrupt_before=["physician_review"]
```

Le médecin peut :

- Lire la synthèse IA.
- Ajouter ses observations.
- Modifier les recommandations.
- Valider la décision finale.

Cette étape garantit la sécurité du système.

---

## 4. Report Agent

Fichier :

```
backend/app/nodes/report_agent.py
```

Responsable de la création du rapport final.

Il récupère :

- Messages du patient.
- Réponses aux questions.
- Synthèse IA.
- Validation du médecin.

Puis il génère un rapport structuré.

---

#  Gestion d'État LangGraph

L'état global est défini dans :

```
backend/app/state.py
```

Exemple :

```python
class MedicalState(TypedDict):

    messages: list

    question_count: int

    diagnostic_summary: str

    interim_care: str

    physician_treatment: str

    final_report: str
```

Tous les agents utilisent cet état partagé.

---

#  MCP (Model Context Protocol)

Le projet contient un serveur MCP :

```
mcp_server/
```

Le serveur permet de gérer les ressources médicales externes.

Architecture :

```text

Diagnostic Agent

       │

       ▼

    MCP Client

       │

       ▼

    MCP Server

       │

       ▼

 guidelines.json

```

Avantages :

- Séparation des connaissances.
- Maintenance facile.
- Ajout de nouvelles directives sans modifier l'agent.

---

#  Technologies Utilisées

## Backend

- Python 3.11+
- FastAPI
- Uvicorn


## Intelligence Artificielle

- LangGraph
- LangChain
- Llama 3.3
- Groq API


## Frontend

- React.js
- JavaScript
- HTML
- CSS


## Protocoles

- MCP (Model Context Protocol)


## Documents

- Génération PDF

---

#  Structure du Projet

```
projet-clinique-ia/

│
├── backend/
│
│   ├── app/
│   │
│   │   ├── nodes/
│   │   │
│   │   ├── diagnostic_agent.py
│   │   ├── physician_review.py
│   │   ├── report_agent.py
│   │   └── supervisor.py
│   │   
│   │   ├── tools/ 
│   │   │
│   │   ├──patient_tools.py
│   │   ├── care_tools.py
│   │   └──mcp_client.py 

│   ├── langgraph.json
│   ├── requirements.txt 
│   ├── api.py
│   │
│── mcp_server/
│             └─
│──server.py 
│
│
├── frontend/
│
│   ├── src/
│   ├── public/
│   ├── package.json
│
│
└── README.md

```

---

#  Installation

## Prérequis

Installer :

- Python >= 3.11
- Node.js >= 20
- npm
- Git


---

#  Backend

Entrer dans le dossier :

```bash
cd backend
```

Créer l'environnement :

```bash
python -m venv .venv
```

Activer :

Windows :

```powershell
.venv\Scripts\activate
```

Installer :

```bash
pip install -r requirements.txt
```

---

# Configuration API

Créer :

```
backend/.env
```

Ajouter :

```env
GROQ_API_KEY=your_key

MODEL_NAME=llama-3.3-70b-versatile
```

---

#  Lancement

## Terminal 1 : Backend FastAPI

```powershell
cd backend

.venv\Scripts\activate

$env:PYTHONPATH="backend"; python -m uvicorn app.api:app --reload           
```

API :

```
http://localhost:8000
```

Swagger :

```
http://localhost:8000/docs
```

---

## Terminal 2 : MCP Server

```powershell
cd backend

backend\.venv\Scripts\activate
npx @modelcontextprotocol/inspector python ../mcp_server/server.py

---

## Terminal 3 : Frontend

```bash 
cd frontend

npm install

npm start
```

Application :

```
http://localhost:3000
```

---

#  Sécurité

Le système applique :

- Validation humaine obligatoire.
- Pas de diagnostic automatique.
- Pas de prescription automatique.
- Contrôle médecin avant rapport final.

---


#  Auteur

**Abderrahmane Sbaii**

Étudiant Ingénierie Informatique et Réseaux (4IIR)

École Marocaine des Sciences de l'Ingénieur (EMSI)

---

#  Licence

Projet développé dans un cadre pédagogique et académique.
