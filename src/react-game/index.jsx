import React from 'react'
import ReactDOM from 'react-dom/client'
import { Provider } from 'react-redux'
import App from './containers'
import store from './store'
import './control/keyboard'

const root = ReactDOM.createRoot(document.getElementById('react-root'))
root.render(
  <React.StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </React.StrictMode>
)
