// Open the floating AI assistant (src/components/chat/ChatWidget.tsx) from anywhere.
export const OPEN_ASSISTANT_EVENT = "capimax:open-assistant";

export function openAssistant() {
  window.dispatchEvent(new Event(OPEN_ASSISTANT_EVENT));
}
