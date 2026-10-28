```javascript
const chatForm = document.getElementById("chat-form");
const messageInput = document.getElementById("message-input");
const messagesContainer = document.getElementById("messages");

const replyPreview = document.getElementById("reply-preview");
const replyPreviewText = document.getElementById("reply-preview-text");
const cancelReplyButton = document.getElementById("cancel-reply");

let replyingTo = null;

// Select the message to reply to.
document.addEventListener("click", (event) => {
  const button = event.target.closest(".reply-button");
  if (!button) return;

  const message = button.closest(".message");
  if (!message) return;

  replyingTo = {
    id: message.dataset.messageId,
    username: message.querySelector(".username")?.textContent || "User",
    text: message.querySelector(".message-text")?.textContent || ""
  };

  replyPreviewText.textContent =
    `Replying to ${replyingTo.username}: ${replyingTo.text}`;

  replyPreview.hidden = false;
  messageInput.focus();
});

// Cancel replying.
cancelReplyButton.addEventListener("click", () => {
  replyingTo = null;
  replyPreview.hidden = true;
});

// Send the message.
chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const text = messageInput.value.trim();
  if (!text) return;

  const newMessage = {
    id: crypto.randomUUID(),
    text,
    replyTo: replyingTo ? replyingTo.id : null
  };

  // Connect this to your chat backend to send and save the message.
  if (typeof sendMessage === "function") {
    await sendMessage(newMessage);
  } else {
    console.error(
      "Connect newMessage to your existing chat backend's sendMessage function.",
      newMessage
    );
    return;
  }

  messageInput.value = "";
  replyingTo = null;
  replyPreview.hidden = true;
});
```
