# KidCheck 🛡️
Analyzátor vhodnosti her pro děti – poháněný Claude AI

## Struktura projektu
```
kidcheck/
├── api/
│   └── analyze.js      ← Serverless funkce (backend, API klíč je zde)
├── public/
│   └── index.html      ← Frontend (bez API klíče)
├── vercel.json         ← Konfigurace Vercel
└── README.md
```

## Nasazení na Vercel (krok za krokem)

### 1. Vytvoř účet na Vercel
Jdi na https://vercel.com a zaregistruj se (zdarma, stačí GitHub/Google účet).

### 2. Nainstaluj Vercel CLI (volitelné, lze i přes web)
```bash
npm install -g vercel
```

### 3. Nahraj projekt
**Možnost A – přes web (bez instalace):**
- Jdi na https://vercel.com/new
- Zvol "Browse" a nahraj celou složku `kidcheck`

**Možnost B – přes terminál:**
```bash
cd kidcheck
vercel
```

### 4. Nastav API klíč jako environment variable
V Vercel dashboardu:
1. Otevři svůj projekt
2. Jdi do **Settings → Environment Variables**
3. Přidej:
   - **Name:** `ANTHROPIC_API_KEY`
   - **Value:** `sk-ant-api03-...` (tvůj klíč z console.anthropic.com)
4. Klikni **Save**
5. Jdi do **Deployments** a klikni **Redeploy**

### 5. Hotovo!
Vercel ti dá link ve formátu `https://kidcheck-xxx.vercel.app` – ten sdílíš.

## Jak získat Anthropic API klíč
1. Jdi na https://console.anthropic.com
2. Zaregistruj se
3. Settings → API Keys → Create Key
4. Nové účty dostávají free kredity (~$5)
5. Jedno hodnocení hry stojí cca $0.01–0.03

## Funkce appky
- ✅ Zadání Google Play URL
- ✅ Nahrání screenshotu / ikony hry
- ✅ Ruční zadání názvu hry
- ✅ Hodnocení pro konkrétní věk dítěte
- ✅ 6 kritérií hodnocení s detaily (najeď myší)
- ✅ Celkové skóre a verdikt
- ✅ Doporučení pro rodiče
