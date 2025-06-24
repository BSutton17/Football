import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { Provider } from './Context/AppContext.jsx'
import { HandlerProvider } from './Context/HandlerContext.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
    <Provider>
      <HandlerProvider>
      <React.StrictMode>
        <App />
      </React.StrictMode>
      </HandlerProvider>
    </Provider>,
)