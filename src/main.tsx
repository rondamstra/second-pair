import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { configureAmplify } from './config'
import './styles.css'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element #root not found')
}

const root = createRoot(rootElement)

// Configure Amplify from the generated outputs before rendering so the app can
// read the deployed API endpoint. If outputs are missing the UI still renders,
// but a review attempt then fails visibly (no mock/static fallback exists).
configureAmplify().finally(() => {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
