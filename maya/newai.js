const chatBody = document.querySelector(".chat-body");
const messageInput = document.querySelector(".message-input");
const sendMessageButton = document.querySelector("#send-message");
const fileInput = document.querySelector("#file-input");
const fileuploadWrapper = document.querySelector(".file-upload-wrapper");
const fileCancelButton = document.querySelector("#file-cancel");
const chatbotToggler = document.querySelector("#chatbot-toggler");
const closChatbot = document.querySelector("#close-chatbot");

const API_KEY = "AIzaSyBcxrikiiAIAscisHUww20hmh27Nh5aV9U";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;

const GOOGLE_SEARCH_API_KEY = "AIzaSyA1RX77jHYaXxaDgobaLXHCEe0zk5Az2Oc";  // <-- replace
const GOOGLE_CX = "c3317a7c26a524fbf";    // <-- replace

const userData = {
    message: null,
    file: {
        data: null,
        mime_type: null
    }
};
const chatHistory = [];
const initialInputHeight = messageInput.scrollHeight;

const createMessageElement = (content, ...classes) => {
    const div = document.createElement("div");
    div.classList.add("message", ...classes);
    div.innerHTML = content;
    return div;
};

// --- IMAGE GENERATION WITH HUGGINGFACE ---
const generateImageFromPrompt = async (prompt) => {
    const response = await fetch("https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-2", {
        method: "POST",
        headers: {
            Authorization: "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",
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ inputs: prompt })
    });
    const blob = await response.blob();
    return URL.createObjectURL(blob);
};

// --- GOOGLE SEARCH (TEXT RESULTS) ---
const searchGoogle = async (query) => {
    const url = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(query)}&key=${GOOGLE_SEARCH_API_KEY}&cx=${GOOGLE_CX}`;
    const response = await fetch(url);
    const data = await response.json();

    if (!data.items) return "No results found.";

    return data.items.slice(0, 3).map(item => {
        return `<p><a href="${item.link}" target="_blank">${item.title}</a><br>${item.snippet}</p>`;
    }).join("");
};

// --- GOOGLE IMAGE SEARCH ---
const searchImage = async (query) => {
    const url = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(query)}&searchType=image&key=${GOOGLE_SEARCH_API_KEY}&cx=${GOOGLE_CX}`;
    const response = await fetch(url);
    const data = await response.json();

    if (!data.items) return "No images found.";
    return `<img src="${data.items[0].link}" alt="Search result" style="max-width:100%; border-radius:10px;" />`;
};

// --- DECISION MAKER ---
const needsWebSearch = (text) => {
    const keywords = ["latest", "news", "today", "2025", "price", "from google", "search", "website", "link"];
    return keywords.some(word => text.toLowerCase().includes(word));
};

const needsImageSearch = (text) => {
    const keywords = ["show me", "image", "picture", "photo", "wallpaper"];
    return keywords.some(word => text.toLowerCase().includes(word));
};

// --- BOT RESPONSE ---
const generateBotResponse = async (incomingMessageDiv) => {
    const messageElement = incomingMessageDiv.querySelector(".message-text");

    // If user explicitly asks for AI-drawn image
    if (userData.message.toLowerCase().startsWith("image:") || userData.message.toLowerCase().startsWith("draw:")) {
        const prompt = userData.message.replace(/^(image:|draw:)/i, "").trim();
        try {
            const imageUrl = await generateImageFromPrompt(prompt);
            messageElement.innerHTML = `<img src="${imageUrl}" alt="AI generated image" style="max-width: 100%; border-radius: 10px;" />`;
        } catch (err) {
            messageElement.innerText = "Failed to generate image.";
        } finally {
            incomingMessageDiv.classList.remove("thinking");
            chatBody.scrollTo({ top: chatBody.scrollHeight, behavior: "smooth" });
        }
        return;
    }

    try {
        let apiResponseText = "";

        // 🔹 Auto Web Search
        if (needsWebSearch(userData.message)) {
            apiResponseText = await searchGoogle(userData.message);
            messageElement.innerHTML = apiResponseText;

        // 🔹 Auto Image Search
        } else if (needsImageSearch(userData.message)) {
            apiResponseText = await searchImage(userData.message);
            messageElement.innerHTML = apiResponseText;

        // 🔹 Otherwise → Gemini
        } else {
            chatHistory.push({
                role: "user",
                parts: [{ text: userData.message }, ...(userData.file.data ? [{ inline_data: userData.file }] : [])]
            });

            const requestOptions = {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contents: chatHistory })
            };

            const response = await fetch(API_URL, requestOptions);
            const data = await response.json();
            if (!response.ok) throw new Error(data.error.message);

            apiResponseText = data.candidates[0].content.parts[0].text.replace(/\*\*(.*?)\*\*/g, "$1").trim();
            messageElement.innerText = apiResponseText;

            chatHistory.push({
                role: "model",
                parts: [{ text: apiResponseText }]
            });
        }

    } catch (error) {
        console.log(error);
        messageElement.innerText = "Oops! Something went wrong.";
    } finally {
        userData.file = {};
        incomingMessageDiv.classList.remove("thinking");
        chatBody.scrollTo({ top: chatBody.scrollHeight, behavior: "smooth" });
    }
};

// --- OUTGOING MESSAGE HANDLER ---
const handleOutgoingMessage = (e = {}) => {
    if (e.preventDefault) e.preventDefault();

    userData.message = messageInput.value.trim();
    if (!userData.message) return;

    messageInput.value = "";
    fileuploadWrapper.classList.remove("file-uploaded");
    messageInput.dispatchEvent(new Event("input"));

    const messageContent = `<div class="message-text"></div>
                            ${userData.file.data ? `<img src="data:${userData.file.mime_type};base64,${userData.file.data}" class="attachment"/>` : ""}`;
    const outgoingMessageDiv = createMessageElement(messageContent, "user-message");
    outgoingMessageDiv.querySelector(".message-text").textContent = userData.message;
    chatBody.appendChild(outgoingMessageDiv);
    chatBody.scrollTo({ top: chatBody.scrollHeight, behavior: "smooth" });

    setTimeout(() => {
        const botMessageContent = `
            <svg class="bot-avatar" xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 1024 1024" fill="currentColor">
                <path d="M512 64C282.77 64 96 250.77 96 480c0 160.64 94.58 299.05 231.44 362.52L288 960l96-32 64 64 64-64 96 32-39.44-117.48C833.42 779.05 928 640.64 928 480c0-229.23-186.77-416-416-416zm0 768c-194.46 0-352-157.54-352-352S317.54 128 512 128s352 157.54 352 352-157.54 352-352 352zm0-512c-88.22 0-160 71.78-160 160s71.78 160 160 160 160-71.78 160-160-71.78-160-160-160z"/>
            </svg>
            <div class="message-text">
                <div class="thinking-indicator">
                    <div class="dot"></div>
                    <div class="dot"></div>
                    <div class="dot"></div>
                </div>
            </div>
        `;
        const incomingMessageDiv = createMessageElement(botMessageContent, "bot-message", "thinking");
        chatBody.appendChild(incomingMessageDiv);
        chatBody.scrollTo({ top: chatBody.scrollHeight, behavior: "smooth" });
        generateBotResponse(incomingMessageDiv);
    }, 600);
};

// --- EVENT LISTENERS ---
messageInput.addEventListener("keydown", (e) => {
    const userMessage = e.target.value.trim();
    if (e.key === "Enter" && userMessage && !e.shiftKey && window.innerWidth > 768) {
        handleOutgoingMessage(e);
    }
});
messageInput.addEventListener("input", () => {
    messageInput.style.height = `${initialInputHeight}px`;
    messageInput.style.height = `${messageInput.scrollHeight}px`;
    document.querySelector(".chat-form").style.borderRadius = messageInput.scrollHeight > initialInputHeight ? "15px" : "32px";
});

fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        fileuploadWrapper.querySelector("img").src = e.target.result;
        fileuploadWrapper.classList.add("file-uploaded");
        const base64String = e.target.result.split(",")[1];
        userData.file = {
            data: base64String,
            mime_type: file.type
        };
        fileInput.value = "";
    };
    reader.readAsDataURL(file);
});
fileCancelButton.addEventListener("click", () => {
    userData.file = {};
    fileuploadWrapper.classList.remove("file-uploaded");
});

const picker = new EmojiMart.Picker({
    theme: "light",
    skinTonePosition: "none",
    previewPosition: "none",
    onEmojiSelect: (emoji) => {
        const { selectionStart: start, selectionEnd: end } = messageInput;
        messageInput.setRangeText(emoji.native, start, end, "end");
        messageInput.focus();
    },
    onClickOutside: (e) => {
        if (e.target.id === "emoji-picker") {
            document.body.classList.toggle("show-emoji-picker");
        } else {
            document.body.classList.remove("show-emoji-picker");
        }
    }
});
document.querySelector(".chat-form").appendChild(picker);

sendMessageButton.addEventListener("click", (e) => handleOutgoingMessage(e));
document.querySelector("#file-upload").addEventListener("click", () => fileInput.click());
chatbotToggler.addEventListener("click", () => document.body.classList.toggle("show-chatbot"));
closChatbot.addEventListener("click", () => document.body.classList.remove("show-chatbot"));
