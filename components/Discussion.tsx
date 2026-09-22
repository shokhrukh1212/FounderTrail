"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ProductComment } from "@/lib/product-community";

function CommentCard({ comment, slug, signedIn, onChanged, replies }: {
  comment: ProductComment;
  slug: string;
  signedIn: boolean;
  onChanged: () => void;
  replies: ProductComment[];
}) {
  const router = useRouter();
  const [replying, setReplying] = useState(false);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(comment.body);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submitReply() {
    if (!reply.trim() || busy) return;
    setBusy(true); setMessage("");
    const response = await fetch(`/api/products/${encodeURIComponent(slug)}/comments`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ body: reply, parentId: comment.id }),
    });
    if (response.status === 401) { router.push(`/sign-in?returnTo=${encodeURIComponent(location.pathname + "#discussion")}`); return; }
    const result = await response.json() as { error?: string };
    if (response.ok) onChanged(); else setMessage(result.error ?? "Could not reply.");
    setBusy(false);
  }

  async function saveEdit() {
    if (!text.trim() || busy) return;
    setBusy(true); setMessage("");
    const response = await fetch(`/api/products/${encodeURIComponent(slug)}/comments`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: comment.id, body: text }),
    });
    const result = await response.json() as { error?: string };
    if (response.ok) onChanged(); else setMessage(result.error ?? "Could not save.");
    setBusy(false);
  }

  async function report() {
    const reason = window.prompt("Briefly tell us what is wrong with this comment:");
    if (!reason) return;
    const response = await fetch(`/api/comments/${comment.id}/report`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason }),
    });
    if (response.status === 401) { router.push(`/sign-in?returnTo=${encodeURIComponent(location.pathname + "#discussion")}`); return; }
    setMessage(response.ok ? "Report received. Thank you." : "Could not send the report.");
  }

  async function remove() {
    if (!window.confirm("Hide your comment? The moderation record is retained.")) return;
    setBusy(true);
    const response = await fetch(`/api/products/${encodeURIComponent(slug)}/comments`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: comment.id }) });
    if (response.ok) onChanged(); else setMessage("Could not hide this comment.");
    setBusy(false);
  }

  return <article className={`discussion-comment${comment.parentId ? " is-reply" : ""}`}>
    <header><strong>{comment.authorName}</strong>{comment.isFounder ? <span className="founder-label">Founder</span> : null}<time dateTime={comment.createdAt.toISOString()}>{comment.createdAt.toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}</time>{comment.editedAt ? <small>Edited</small> : null}</header>
    {editing ? <div className="comment-editor"><textarea value={text} maxLength={2000} onChange={(event) => setText(event.target.value)} /><div><button className="button button-primary" disabled={busy} onClick={() => void saveEdit()}>Save</button><button className="button button-secondary" onClick={() => setEditing(false)}>Cancel</button></div></div> : <p>{comment.body}</p>}
    <div className="comment-actions">{!comment.parentId && signedIn ? <button onClick={() => setReplying((value) => !value)}>Reply</button> : null}{comment.isAuthor ? <button onClick={() => setEditing(true)}>Edit</button> : null}{comment.isAuthor ? <button disabled={busy} onClick={() => void remove()}>Hide</button> : null}{signedIn && !comment.isAuthor ? <button onClick={() => void report()}>Report</button> : null}</div>
    {replying ? <div className="comment-editor"><label>Reply<textarea value={reply} maxLength={2000} onChange={(event) => setReply(event.target.value)} /></label><button className="button button-primary" disabled={busy} onClick={() => void submitReply()}>Post reply</button></div> : null}
    {message ? <p className="form-message" role="status">{message}</p> : null}
    {replies.map((item) => <CommentCard key={item.id} comment={item} slug={slug} signedIn={signedIn} onChanged={onChanged} replies={[]} />)}
  </article>;
}

export function Discussion({ slug, initialComments, signedIn }: { slug: string; initialComments: ProductComment[]; signedIn: boolean }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const topLevel = initialComments.filter((comment) => !comment.parentId);
  function refresh() { router.refresh(); }
  async function submit() {
    if (!body.trim() || busy) return;
    setBusy(true); setMessage("");
    const response = await fetch(`/api/products/${encodeURIComponent(slug)}/comments`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ body }),
    });
    if (response.status === 401) { router.push(`/sign-in?returnTo=${encodeURIComponent(location.pathname + "#discussion")}`); return; }
    const result = await response.json() as { error?: string };
    if (response.ok) refresh(); else setMessage(result.error ?? "Could not post your comment.");
    setBusy(false);
  }
  return <div className="discussion-list">
    {signedIn ? <div className="comment-composer"><label htmlFor="new-comment">Ask a question or share useful feedback</label><textarea id="new-comment" value={body} maxLength={2000} onChange={(event) => setBody(event.target.value)} placeholder="Keep it specific and constructive." /><div><small>{body.length}/2000</small><button className="button button-primary" disabled={busy || !body.trim()} onClick={() => void submit()}>Post comment</button></div>{message ? <p role="alert">{message}</p> : null}</div> : <div className="quiet-empty"><strong>Join the discussion</strong><p><Link href={`/sign-in?returnTo=${encodeURIComponent(`/product/${slug}#discussion`)}`}>Sign in</Link> to ask the founder a question or leave feedback.</p></div>}
    {topLevel.length ? topLevel.map((comment) => <CommentCard key={comment.id} comment={comment} slug={slug} signedIn={signedIn} onChanged={refresh} replies={initialComments.filter((reply) => reply.parentId === comment.id)} />) : <div className="quiet-empty">No questions yet. Start the conversation.</div>}
  </div>;
}
