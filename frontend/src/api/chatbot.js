import { apiRequest } from './client'

export function fetchChatbotWelcome() {
  return apiRequest('/chatbot/welcome')
}

export function sendChatbotMessage({ message, history = [], state = {} }) {
  return apiRequest('/chatbot/message', {
    method: 'POST',
    body: JSON.stringify({ message, history, state }),
  })
}
