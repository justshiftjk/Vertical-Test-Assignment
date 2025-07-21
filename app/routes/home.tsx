import { useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { redirect, useFetcher } from "react-router";
import { PrismaClient } from '@prisma/client';
import { generateText } from "ai";
import { groq } from "@ai-sdk/groq";

import { commitSession, destroySession, getSession } from "~/sessions.server";
import pushIcon from "../assets/image/ico-push.png";
import { ArrowUpIcon, ChevronDown, ChevronUp, DeleteIcon, Trash, Trash2 } from "lucide-react";
import type { Route } from "./+types/home";

// Supabase client setup
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Prisma client setup
const prisma = new PrismaClient();
// Define Pipeline type
interface Pipeline {
  id: string;
  type: string;
  param?: string;
}
// Loader function: Fetches user session and recent chats for the home page
export async function loader({ request, params }: import("./+types/home").Route.LoaderArgs) {
  const session = await getSession(request.headers.get("Cookie"));
  const error = session.get("error");
  const info = session.get("info");
  const user = session.get('user');
  if (!user) {
    return redirect("/");
  }

  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor");

  const chats = await prisma.chat.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 10,
    ...(cursor && {
      skip: 1,
      cursor: { id: cursor },
    }),
  });

  // Return loader data as a plain object
  return {
    error,
    info,
    chats: chats.reverse(),
    headers: {
      "Set-Cookie": await commitSession(session),
    },
  };
}

function getPrompt(step: Pipeline, input: string): string {
  switch (step.type) {
    case "summarize":
      return `Summarize the following:\n\n${input}`;
    case "translate":
      return `Translate this to ${step.param}:\n\n${input}`;
    case "rewrite":
      return `Rewrite this to sound more ${step.param}:\n\n${input}`;
    case "extract":
      return `Extract key entities:\n\n${input}`;
    default:
      return input
  }
}

async function parseGoalToPipeline(input: string) {
  try {
    const { text } = await generateText({
      model: groq("meta-llama/llama-4-scout-17b-16e-instruct"),
      messages: [
        {
          role: "user",
          content: `Create a step-by-step AI pipeline for this goal: ${input}.
          Only return a JSON array of steps like 
          [
            {"type": "summarize"}, 
            {"type":"rewrite", "param":"casual" or "formal" or "professional"}, 
            {"type":"extract", "param": "keyword" or "entities"}, 
            {"type":"translate", "param":"en" or "fr" or "jp" or "ch" or "it"}
          ]. the type can be only four value "summarize", "rewrite", "extract" and "translate" but don't need to all of them exist,
          add them according to goal.
          don't make result like start with "Here is the JSON array of steps to .." I just want pure json result. 
          `,
        },
      ],
    });

    if (text) {
      // Parse JSON and fix potential unquoted property names
      const pipeline = JSON.parse(text.replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":'));
      return pipeline;
    }
    return false;
  } catch (e) {
    // Log error for debugging but don't expose to user
    console.error("Pipeline generation failed:", e);
    return false;
  }
}

async function runPipeline(pipeline: Pipeline[], input: string) {
  let currentOutput = input;

  for (const step of pipeline) {
    const prompt = getPrompt(step, currentOutput);

    const { text } = await generateText({
      model: groq("meta-llama/llama-4-scout-17b-16e-instruct"),
      messages: [{ role: "user", content: prompt }],
    });

    currentOutput = text;
  }

  return currentOutput;
}

// Action function: Handles prompt submission, AI response, and signout
export async function action({ params, request }: import("./+types/home").Route.ActionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");
  const session = await getSession(request.headers.get("Cookie"));
  const user = session.get('user');

  // Signout from homepage
  if (intent === "signout") {
    await supabase.auth.signOut();
    return redirect("/", {
      headers: {
        "Set-Cookie": await destroySession(session),
      },
    });
  }

  // Handle Auto pipeline generation
  if (intent === "auto") {
    const prompt = formData.get("prompt")?.toString() || "";
    if (!prompt) return;

    try {
      const pipeline = await parseGoalToPipeline(prompt);
      if (pipeline) {
        return {
          pipeline,
          headers: {
            "Set-Cookie": await commitSession(session),
          },
        };
      }
    } catch (err: any) {
      session.flash("error", "Failed to generate pipeline. Try again.");
      return redirect("/home", {
        headers: {
          "Set-Cookie": await commitSession(session),
        },
      });
    }
  }
  else if (intent === "pipeline") {
    const prompt = formData.get("prompt")?.toString() || "";
    const pipelineData = formData.get("pipeline")?.toString() || "";

    if (!prompt || !pipelineData) return;

    try {
      const pipeline = JSON.parse(pipelineData);
      const result = await runPipeline(pipeline, prompt);

      // Save to database
      await prisma.chat.create({
        data: {
          prompt,
          result,
          pipeline,
          userId: user.id,
        },
      });

      return redirect("/home", {
        headers: {
          "Set-Cookie": await commitSession(session),
        },
      });
    } catch (err: any) {
      session.flash("error", "Pipeline execution failed. Try again.");
      return redirect("/home", {
        headers: {
          "Set-Cookie": await commitSession(session),
        },
      });
    }
  }

  const prompt = formData.get("prompt")?.toString() || "";
  if (!prompt) return;

  try {
    // Generate AI response
    const { text } = await generateText({
      model: groq("meta-llama/llama-4-scout-17b-16e-instruct"),
      prompt,
    });

    await prisma.chat.create({
      data: {
        prompt,
        result: text,
        userId: user.id,
      },
    });

    return redirect("/home", {
      headers: {
        "Set-Cookie": await commitSession(session),
      },
    });
  } catch (err: any) {
    session.flash("error", "Something went wrong. Try again.");
    return redirect("/home", {
      headers: {
        "Set-Cookie": await commitSession(session),
      },
    });
  }
}

// Home component: Main chat UI and logic
export default function Home({ loaderData }: Route.ComponentProps) {
  const initialChats = loaderData?.chats || [];
  const [chats, setChats] = useState(initialChats); // oldest to newest
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState("");
  const [lang, setLang] = useState("english")
  const [tone, setTone] = useState("casual");
  const [extract, setExtract] = useState("keyword");
  const containerRef = useRef<HTMLDivElement>(null);
  const fetcher = useFetcher();
  const bottomRef = useRef<HTMLDivElement>(null);

  // Map pipeline type to Tailwind border color class
  const typeBorderColor: Record<string, string> = {
    summarize: 'green-400',
    translate: 'red-400',
    rewrite: 'blue-400',
    extract: 'purple-400',
  };

  const [pipelines, setPipelines] = useState<Pipeline[]>([]);

  const handleAddPipline = (type: string, param?: string) => {
    const id = crypto.randomUUID();
    const newPipeline: Pipeline = { id, type, param };
    setPipelines(prev => [...prev, newPipeline]);
  };

  const handleRemovePipline = (id: string) => {
    setPipelines(prev => prev.filter(p => p.id !== id));
  };

  const handleReorderPipline = (index: number, up: boolean) => {
    setPipelines(prev => {
      const newPipelines = [...prev];
      if (up && index > 0) {
        // Swap with previous
        [newPipelines[index - 1], newPipelines[index]] = [newPipelines[index], newPipelines[index - 1]];
      } else if (!up && index < newPipelines.length - 1) {
        // Swap with next
        [newPipelines[index], newPipelines[index + 1]] = [newPipelines[index + 1], newPipelines[index]];
      }
      return newPipelines;
    });
  };

  // Load older messages when scroll to top
  const handleScroll = () => {
    if (!containerRef.current || !hasMore || fetcher.state === "loading") return;
    if (containerRef.current.scrollTop < 50) {
      const oldest = chats[0];
      fetcher.load(`/home?cursor=${oldest.createdAt}`);
    }
  };

  // Helper to format a pipeline step for display (e.g., 'Summarize (casual)')
  const formatStep = (step: { type: string; param?: string }) => {
    // Capitalize the type and append param if present
    const label = step.type.charAt(0).toUpperCase() + step.type.slice(1);
    return step.param ? `${label} (${step.param})` : label;
  };

  // Handle loading and input reset on submit
  useEffect(() => {
    if (fetcher.state === 'submitting') {
      setLoading(true); // spinner starts

      // Clear input based on intent:
      // - Keep input for 'auto' (so user can run pipeline with same input)
      // - Clear input for 'pipeline' and regular submissions
      if (fetcher.formData?.get('intent') !== 'auto') {
        setInput("");
      }
      // Clear pipelines for non-pipeline intents (clean slate for new tasks)
      if (fetcher.formData?.get('intent') === 'pipeline') {
        setPipelines([]);
      }

      if (bottomRef.current) {
        bottomRef.current.scrollIntoView({ behavior: "smooth" });
      }
    } else if (fetcher.state === 'idle') {
      setLoading(false); // spinner ends
    }
  }, [fetcher.state, fetcher.formData]);

  // Append older messages when fetched
  useEffect(() => {
    if (fetcher.data?.newChat) {
      setChats((prev: any) => [fetcher.data.newChat.reverse(), ...prev]);
    }
    if (!fetcher.state || fetcher.state === "idle") {
      setLoading(false); // hide spinner
    }
  }, [fetcher.data]);

  // Reset chats when initialChats change
  useEffect(() => {
    setChats(initialChats);
  }, [initialChats]);

  // Scroll to bottom when chats update
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chats]);

  // Handle pipeline response from Auto button
  useEffect(() => {
    if (fetcher.data?.pipeline && Array.isArray(fetcher.data.pipeline)) {
      // Convert server response to local pipeline state with unique IDs
      const newPipelines = fetcher.data.pipeline.map((step: any) => ({
        id: crypto.randomUUID(),
        type: step.type,
        param: step.param,
      }));
      setPipelines(newPipelines);
    }
  }, [fetcher.data]);

  return (
    <main className="flex flex-col h-full items-center">
      {/* Main chat container */}
      <div className="space-y-2 max-w-4xl w-full flex flex-col h-full py-8 px-12 dark:bg-gray-800">
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="space-y-4 max-w-4xl w-full overflow-y-auto pb-20 flex-1 px-2"
        >
          {/* Render chat messages */}
          {chats.map((chat: any, idx: number) => (
            <div key={chat.id ?? idx} className="space-y-2">
              <div className="p-3 rounded-lg bg-blue-500 max-w-[80%] w-fit text-white ml-auto whitespace-pre-wrap">
                {chat.prompt}
                <p className="text-green-300">{chat?.pipeline?.map(formatStep).join(" → ") ?? ""}</p>
              </div>
              <div className="p-3 rounded-lg max-w-[80%] bg-gray-50 border border-gray-500/20 text-gray-900 mr-auto text-left whitespace-pre-wrap">
                {chat.result}
              </div>
            </div>
          ))}
          {/* Loading more indicator */}
          {fetcher.state === "loading" && (
            <div className="text-center text-sm py-2 text-gray-500">Loading more...</div>
          )}
          {/* Spinner for submitting/loading */}
          {loading && (
            <div className="flex justify-end pr-4">
              <svg className="animate-spin h-6 w-6 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
              </svg>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
        {/* Prompt input form */}
        <fetcher.Form method="post" action="/home" className="dark:bg-white dark:text-black flex flex-col gap-2 shadow-md p-2 rounded-2xl max-w-3xl w-full mx-auto">
          <input type="hidden" name="conversation" />
          <input type="hidden" name="pipeline" value={JSON.stringify(pipelines)} />
          <div className="flex flex-col gap-2">
            {pipelines.map((item, idx) => (
              <div
                className={`rounded-full border flex justify-between items-center gap-2 bg-gradient-to-r from-${typeBorderColor[item.type] || typeBorderColor.default} to-transparent border-${typeBorderColor[item.type] || typeBorderColor.default}`}
                key={item.id}
              >
                <div className={`rounded-full text-white flex items-center justify-center w-12 h-12 bg-${typeBorderColor[item.type] || typeBorderColor.default}`}>
                  <span className="text-xl font-bold">{idx + 1}</span>
                </div>
                <div className="flex gap-2 items-center">
                  <span className="font-mono capitalize">{item.type}</span>
                  {item.param && <span className="text-gray-500 text-xs">({item.param})</span>}
                </div>
                <div className="flex">
                  <button type="button" onClick={() => handleReorderPipline(idx, true)} disabled={idx === 0} title="Move Up" className="px-2 py-1 h-12 w-10 text-xs cursor-pointer bg-gray-200 disabled:opacity-50"><ChevronUp size={20} className="text-gray-600" /></button>
                  <button type="button" onClick={() => handleReorderPipline(idx, false)} disabled={idx === pipelines.length - 1} title="Move Down" className="px-2 py-1 h-12 w-10 text-xs cursor-pointer bg-gray-200 disabled:opacity-50"><ChevronDown size={20} className="text-gray-600" /></button>
                  <button type="button" onClick={() => handleRemovePipline(item.id)} title="Remove" className="px-2 py-1 h-12 w-10 text-xs cursor-pointer bg-red-200 text-red-700 rounded-r-full"><Trash2 size={20} className="text-gray-600" /></button>
                </div>
              </div>
            ))}
          </div>
          <textarea
            name="prompt"
            className="h-24 p-2 rounded-2xl outline-none border border-black/10 "
            placeholder="Type your message..."
            required
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <div className="flex flex-col gap-3">
            <div className="flex justify-between gap-8 items-center">
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => { handleAddPipline("summarize") }} type="button" className="border-green-400 active:scale-95 cursor-pointer hover:scale-105 duration-100 text-white font-bold w-10 h-10 rounded-full bg-green-400">
                  S
                </button>
                <div className="flex gap-2 rounded-full border border-red-400 pr-2">
                  <button onClick={() => { handleAddPipline("translate", lang) }} type="button" className=" active:scale-95 cursor-pointer hover:scale-105 duration-100 text-white font-bold w-10 h-10 rounded-full bg-red-400">
                    T
                  </button>
                  <select className="outline-none cursor-pointer" onChange={(e) => setLang(e.target.value)}>
                    <option value={`English`} defaultChecked>EN</option>
                    <option value={`Dutch `}>NL</option>
                    <option value={`Italian`}>IT</option>
                    <option value={`French`}>FR</option>
                  </select>
                </div>
                <div className="flex gap-2 rounded-full border border-blue-400 pr-2">
                  <button onClick={() => { handleAddPipline("rewrite", tone) }} type="button" className=" active:scale-95 cursor-pointer hover:scale-105 duration-100 text-white font-bold w-10 h-10 rounded-full bg-blue-400">
                    R
                  </button>
                  <select className="outline-none cursor-pointer" onChange={(e) => setTone(e.target.value)}>
                    <option value={`casual`} defaultChecked>Casual</option>
                    <option value={`formal`}>formal</option>
                    <option value={`professional`}>Professional</option>
                  </select>
                </div>
                <div className="flex gap-2 rounded-full border border-purple-400 pr-2">
                  <button onClick={() => { handleAddPipline("extract", extract) }} type="button" className=" active:scale-95 cursor-pointer hover:scale-105 duration-100 text-white font-bold w-10 h-10 rounded-full bg-purple-400">
                    E
                  </button>
                  <select className="outline-none cursor-pointer" onChange={(e) => setExtract(e.target.value)}>
                    <option value={`keywords`} defaultChecked>Keywords</option>
                    <option value={`entities`}>Entities</option>
                  </select>
                </div>

              </div>
              <div className="flex gap-2 items-start">
                <div className="flex flex-col items-center justify-center gap-2">
                  <button
                    type="submit"
                    name="intent"
                    value="auto"
                    className="dark:bg-black/10 w-14 h-14 shrink-0 cursor-pointer hover:scale-105 duration-100 rounded-full border border-black/10 shadow-md flex items-center justify-center"
                  >
                    Auto
                  </button>
                  <p className="text-xs text-[8px] text-center">Auto suggest workflow</p>
                </div>
                <div className="flex flex-col items-center justify-center gap-2">
                  <button
                    type="submit"
                    name="intent"
                    value="pipeline"
                    className="dark:bg-black/10 w-14 h-14 shrink-0 cursor-pointer hover:scale-105 duration-100 rounded-full border border-black/10 shadow-md flex items-center justify-center"
                  >
                    <ArrowUpIcon size={28} className="text-black" />
                  </button>
                  <p className="text-xs text-[8px] text-center">Run workflow</p>

                </div>

              </div>
            </div>
            <div className="flex gap-4 items-center flex-wrap w-full justify-center">
              <div className="flex gap-1 items-center">
                <div className="rounded-full w-2 h-2 text-green-400 bg-green-400"> </div>
                <p className="text-sm">Summarize</p>
              </div>
              <div className="flex gap-1 items-center">
                <div className="rounded-full w-2 h-2 text-red-400 bg-red-400"> </div>
                <p className="text-sm">Translate</p>
              </div>
              <div className="flex gap-1 items-center">
                <div className="rounded-full w-2 h-2 text-blue-400 bg-blue-400"> </div>
                <p className="text-sm">Rewrite</p>
              </div>
              <div className="flex gap-1 items-center">
                <div className="rounded-full w-2 h-2 text-purple-400 bg-purple-400"> </div>
                <p className="text-sm">Extract</p>
              </div>
            </div>
          </div>
        </fetcher.Form>
      </div>
    </main>
  );
}
