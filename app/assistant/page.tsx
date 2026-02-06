"use client"

import * as React from "react"
import { useUser } from "@/components/user-context"
import { ScrollArea } from "@/components/ui/scroll-area"
import { IconWand, IconUser, IconRobot } from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import apiClient from "@/lib/api"
// Import AI Elements
import { PromptInput, PromptInputProvider, PromptInputProps, PromptInputTextarea, PromptInputFooter, PromptInputSubmit } from "@/components/ai-elements/prompt-input"
import { ModelSelector, ModelSelectorTrigger, ModelSelectorContent, ModelSelectorItem, ModelSelectorList, ModelSelectorLogo, ModelSelectorName, ModelSelectorLogoGroup } from "@/components/ai-elements/model-selector"
import { Reasoning, ReasoningTrigger, ReasoningContent } from "@/components/ai-elements/reasoning"
import { SiteHeader } from "@/components/layout/header/site-header"
import { Streamdown } from "streamdown"
import { cjk } from "@streamdown/cjk"
import { code } from "@streamdown/code"
import { math } from "@streamdown/math"
import { mermaid } from "@streamdown/mermaid"

const streamdownPlugins = { cjk, code, math, mermaid }

// Generate UUID
const generateId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return Math.random().toString(36).substring(2, 15);
};

interface Message {
    role: 'user' | 'assistant';
    content: string;
    isThinking?: boolean;
}

export default function AssistantPage() {
    const { user } = useUser()
    const [messages, setMessages] = React.useState<Message[]>([])
    const [isLoading, setIsLoading] = React.useState(false)
    const [chatId, setChatId] = React.useState<string>("")
    const scrollAreaRef = React.useRef<HTMLDivElement>(null)
    const [model, setModel] = React.useState("llama-3.1-8b-instant")

    React.useEffect(() => {
        // Generate or retrieve chatId on mount
        const stored = localStorage.getItem('ai_chat_id');
        if (stored) {
            setChatId(stored);
        } else {
            const newId = generateId();
            setChatId(newId);
            localStorage.setItem('ai_chat_id', newId);
        }
    }, []);

    const scrollToBottom = () => {
        if (scrollAreaRef.current) {
            const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
            if (scrollContainer) {
                scrollContainer.scrollTop = scrollContainer.scrollHeight;
            }
        }
    }

    React.useEffect(() => {
        scrollToBottom()
    }, [messages, isLoading])

    const handleSubmit = async (value: string) => {
        if (!value.trim() || isLoading) return

        const userMessage: Message = { role: 'user', content: value }
        setMessages(prev => [...prev, userMessage])
        setIsLoading(true)

        try {
            // Add thinking/streaming placeholder
            setMessages(prev => [...prev, { role: 'assistant', content: '', isThinking: true }])

            const response = await apiClient.chatAI([userMessage], chatId, model);

            if (!response.ok) throw new Error('Failed to fetch response')
            if (!response.body) throw new Error('No response body')

            const reader = response.body.getReader()
            const decoder = new TextDecoder()
            let assistantMessageContent = ""

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                const chunk = decoder.decode(value, { stream: true })
                const lines = chunk.split('\n\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const dataStr = line.replace('data: ', '').trim();
                        if (dataStr === '[DONE]') break;

                        try {
                            const data = JSON.parse(dataStr);
                            if (data.content) {
                                assistantMessageContent += data.content;

                                setMessages(prev => {
                                    const newMessages = [...prev]
                                    const lastMessage = newMessages[newMessages.length - 1]
                                    if (lastMessage.role === 'assistant') {
                                        lastMessage.content = assistantMessageContent
                                        lastMessage.isThinking = false
                                    }
                                    return newMessages
                                })
                            }
                        } catch (e) {
                            // console.warn('Failed to parse SSE line', line);
                        }
                    }
                }
            }

        } catch (error) {
            console.error('Chat error:', error)
            setMessages(prev => {
                const newMessages = [...prev]
                const lastMessage = newMessages[newMessages.length - 1]
                if (lastMessage.role === 'assistant') {
                    lastMessage.content = "Sorry, I encountered an error. Please try again."
                    lastMessage.isThinking = false
                }
                return newMessages
            })
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="flex flex-col h-full bg-background">
            <SiteHeader sticky />
            <div className="flex h-14 shrink-0 items-center justify-between border-b bg-card px-6">
                <div className="flex items-center gap-2">
                    <IconWand className="size-5 text-primary" />
                    <h1 className="text-lg font-semibold">Assistant</h1>
                </div>

                <ModelSelector>
                    <ModelSelectorTrigger className="px-2 py-1 border rounded hover:bg-muted text-sm flex items-center gap-2">
                        <ModelSelectorLogoGroup>
                            <ModelSelectorLogo provider="llama" />
                        </ModelSelectorLogoGroup>
                        <span>{model}</span>
                    </ModelSelectorTrigger>
                    <ModelSelectorContent title="Select Model">
                        <ModelSelectorList>
                            <ModelSelectorItem onSelect={() => setModel("llama-3.1-8b-instant")}>
                                <ModelSelectorLogo provider="llama" className="mr-2" />
                                <ModelSelectorName>Llama 3.1 8B Instant</ModelSelectorName>
                            </ModelSelectorItem>
                            <ModelSelectorItem onSelect={() => setModel("llama-3.3-70b-versatile")}>
                                <ModelSelectorLogo provider="llama" className="mr-2" />
                                <ModelSelectorName>Llama 3.3 70B Versatile</ModelSelectorName>
                            </ModelSelectorItem>
                        </ModelSelectorList>
                    </ModelSelectorContent>
                </ModelSelector>
            </div>

            <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
                <div className="max-w-3xl mx-auto space-y-6 pb-4">
                    {messages.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-[50vh] text-center text-muted-foreground">
                            <IconWand className="size-12 mb-4 opacity-50" />
                            <h2 className="text-xl font-semibold mb-2">How can I help you today?</h2>
                            <p>Ask me anything about your files or general questions.</p>
                        </div>
                    )}

                    {messages.map((message, index) => (
                        <div
                            key={index}
                            className={cn(
                                "flex gap-3",
                                message.role === 'user' ? "flex-row-reverse" : "flex-row"
                            )}
                        >
                            <div className={cn(
                                "size-8 rounded-full flex items-center justify-center shrink-0 border",
                                message.role === 'user' ? "bg-primary text-primary-foreground" : "bg-muted"
                            )}>
                                {message.role === 'user' ? (
                                    <IconUser className="size-5" />
                                ) : (
                                    <IconWand className="size-5" />
                                )}
                            </div>

                            <div className={cn(
                                "rounded-lg px-4 py-2 max-w-[80%]",
                                message.role === 'user'
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted text-foreground"
                            )}>
                                {message.role === 'assistant' && message.isThinking && (
                                    <Reasoning isStreaming={true} duration={1}>
                                        Thinking...
                                    </Reasoning>
                                )}
                                <div className="text-sm leading-relaxed">
                                    <Streamdown plugins={streamdownPlugins as any}>
                                        {message.content}
                                    </Streamdown>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </ScrollArea>

            <div className="p-4 border-t bg-card">
                <div className="max-w-3xl mx-auto">
                    <PromptInputProvider>
                        <PromptInput
                            onSubmit={(msg) => {
                                handleSubmit(msg.text);
                                return Promise.resolve();
                            }}
                            className="bg-background border rounded-xl overflow-hidden shadow-sm"
                        >
                            <PromptInputTextarea placeholder="Message Assistant..." />
                            <PromptInputFooter className="px-3 pb-3">
                                <PromptInputSubmit />
                            </PromptInputFooter>
                        </PromptInput>
                    </PromptInputProvider>
                </div>
                <div className="text-center mt-2 text-xs text-muted-foreground">
                    AI can make mistakes. Please verify important information.
                </div>
            </div>
        </div>
    )
}
