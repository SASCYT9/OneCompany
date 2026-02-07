"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Save,
  Trash2,
  Upload,
  Link2,
  Eye,
  RefreshCw,
} from "lucide-react";
import type { BlogMedia, BlogPost, SiteContent } from "@/types/site-content";

const createEmptyPost = (): BlogPost => {
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `post-${Date.now()}`;

  return {
    id,
    slug: "",
    title: { ua: "", en: "" },
    caption: { ua: "", en: "" },
    date: new Date().toISOString(),
    status: "draft",
    media: [],
    tags: [],
    location: { ua: "", en: "" },
  };
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

const formatDateInput = (value?: string) => {
  if (!value) return "";
  return value.slice(0, 10);
};

export default function AdminBlogPage() {
  const [content, setContent] = useState<SiteContent | null>(null);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<BlogPost | null>(null);
  const [instagramUrl, setInstagramUrl] = useState("");
  const [instagramHandle, setInstagramHandle] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [newMediaUrl, setNewMediaUrl] = useState("");
  const [newMediaType, setNewMediaType] = useState<"image" | "video">("image");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string>("");
  const [info, setInfo] = useState<string>("");

  const sortedPosts = useMemo(() => {
    return [...posts].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [posts]);

  useEffect(() => {
    loadContent();
  }, []);

  const loadContent = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/content");
      if (response.status === 401) {
        setError("Unauthorized. Please logout and login again.");
        return;
      }
      if (!response.ok) {
        setError("Failed to load content.");
        return;
      }
      const data = (await response.json()) as SiteContent;
      setContent(data);
      setPosts(data.blog?.posts ?? []);
      setInstagramUrl(data.blog?.instagramUrl ?? "");
      setInstagramHandle(data.blog?.instagramHandle ?? "");
      if (data.blog?.posts?.length) {
        const first = data.blog.posts[0];
        setSelectedId(first.id);
        setDraft({ ...first });
        setTagsInput(first.tags?.join(", ") ?? "");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to load content.");
    } finally {
      setLoading(false);
    }
  };

  const selectPost = (post: BlogPost) => {
    setSelectedId(post.id);
    setDraft({ ...post });
    setTagsInput(post.tags?.join(", ") ?? "");
    setInfo("");
  };

  const addNewPost = () => {
    const newPost = createEmptyPost();
    setPosts((prev) => [newPost, ...prev]);
    setSelectedId(newPost.id);
    setDraft({ ...newPost });
    setTagsInput("");
    setInfo("");
  };

  const updateDraft = (changes: Partial<BlogPost>) => {
    setDraft((prev) => (prev ? { ...prev, ...changes } : prev));
  };

  const saveContent = async (updatedPosts: BlogPost[]) => {
    if (!content) return;
    setLoading(true);
    setError("");
    setInfo("");
    try {
      const payload: SiteContent = {
        ...content,
        blog: {
          instagramUrl: instagramUrl.trim(),
          instagramHandle: instagramHandle.trim(),
          posts: updatedPosts,
        },
      };

      const response = await fetch("/api/admin/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.status === 401) {
        setError("Unauthorized. Please logout and login again.");
        return;
      }

      if (!response.ok) {
        setError("Failed to save blog content.");
        return;
      }

      const data = (await response.json()) as SiteContent;
      setContent(data);
      setPosts(data.blog?.posts ?? []);
      setInfo("Saved successfully.");
    } catch (err) {
      console.error(err);
      setError("Failed to save blog content.");
    } finally {
      setLoading(false);
    }
  };

  const handleSavePost = async () => {
    if (!draft) return;
    const normalizedTags = tagsInput
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    const baseTitle = draft.title.ua || draft.title.en;
    const slug = draft.slug?.trim() || slugify(baseTitle);

    const updated = posts.map((post) =>
      post.id === draft.id
        ? {
            ...draft,
            slug,
            tags: normalizedTags,
          }
        : post
    );

    setPosts(updated);
    setDraft((prev) => (prev ? { ...prev, slug, tags: normalizedTags } : prev));
    await saveContent(updated);
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm("Delete this post? This action cannot be undone.")) return;
    const updated = posts.filter((post) => post.id !== postId);
    setPosts(updated);
    if (selectedId === postId) {
      const next = updated[0] ?? null;
      setSelectedId(next?.id ?? null);
      setDraft(next ? { ...next } : null);
      setTagsInput(next?.tags?.join(", ") ?? "");
    }
    await saveContent(updated);
  };

  const handleUploadMedia = async (files: FileList | null) => {
    if (!files || !draft) return;
    setUploading(true);
    setInfo("");
    setError("");

    try {
      const uploaded: BlogMedia[] = [];
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/admin/upload-blog-media", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error("Upload failed");
        }

        const data = await response.json();
        uploaded.push({
          id: typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `media-${Date.now()}`,
          type: data.type?.startsWith("video") ? "video" : "image",
          src: data.url,
          alt: file.name,
        });
      }

      const nextMedia = [...draft.media, ...uploaded];
      updateDraft({ media: nextMedia });
      setInfo("Media uploaded. Remember to save the post.");
    } catch (err) {
      console.error(err);
      setError("Failed to upload media.");
    } finally {
      setUploading(false);
    }
  };

  const handleAddMediaUrl = () => {
    if (!draft || !newMediaUrl.trim()) return;
    const media: BlogMedia = {
      id: typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `media-${Date.now()}`,
      type: newMediaType,
      src: newMediaUrl.trim(),
      alt: draft.title.ua || draft.title.en || "Blog media",
    };
    updateDraft({ media: [...draft.media, media] });
    setNewMediaUrl("");
  };

  const handleRemoveMedia = (mediaId: string) => {
    if (!draft) return;
    updateDraft({ media: draft.media.filter((item) => item.id !== mediaId) });
  };

  const handlePublishToggle = () => {
    if (!draft) return;
    updateDraft({ status: draft.status === "published" ? "draft" : "published" });
  };

  const handleGenerateSlug = () => {
    if (!draft) return;
    const baseTitle = draft.title.ua || draft.title.en;
    updateDraft({ slug: slugify(baseTitle) });
  };

  return (
    <div className="h-full bg-black text-white flex flex-col font-ua overflow-hidden">
      <div className="bg-black/80 backdrop-blur-md border-b border-white/10 px-4 py-3 flex-none z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-medium tracking-tight">Blog</h1>
            <p className="text-xs text-white/50">Instagram-style posts manager</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadContent}
              className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-xs font-medium border border-white/10"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
            <button
              onClick={addNewPost}
              className="flex items-center gap-2 px-3 py-1.5 bg-white text-black rounded-full transition-colors text-xs font-medium"
            >
              <Plus className="w-3.5 h-3.5" />
              New post
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="flex-none border-b border-white/10 bg-black px-4 py-2 text-xs text-red-300">
          {error}
        </div>
      ) : null}

      {info ? (
        <div className="flex-none border-b border-white/10 bg-black px-4 py-2 text-xs text-emerald-300">
          {info}
        </div>
      ) : null}

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-full lg:w-[340px] flex flex-col border-r border-white/10 bg-black">
          <div className="p-4 border-b border-white/10 space-y-3">
            <div>
              <label className="text-xs uppercase tracking-widest text-white/40">Instagram URL</label>
              <input
                value={instagramUrl}
                onChange={(e) => setInstagramUrl(e.target.value)}
                placeholder="https://instagram.com/onecompany.global"
                className="mt-2 w-full rounded-lg border border-white/10 bg-zinc-900/40 px-3 py-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-white/40">Instagram handle</label>
              <input
                value={instagramHandle}
                onChange={(e) => setInstagramHandle(e.target.value)}
                placeholder="@onecompany.global"
                className="mt-2 w-full rounded-lg border border-white/10 bg-zinc-900/40 px-3 py-2 text-xs text-white"
              />
            </div>
            <button
              onClick={() => saveContent(posts)}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-white text-black px-3 py-2 text-xs font-medium disabled:opacity-60"
            >
              <Save className="w-3.5 h-3.5" />
              Save blog settings
            </button>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-white/5">
            {sortedPosts.map((post) => (
              <button
                key={post.id}
                onClick={() => selectPost(post)}
                className={`w-full text-left px-4 py-3 transition-colors ${
                  selectedId === post.id
                    ? "bg-white/10"
                    : "hover:bg-white/5"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-white font-medium">
                        {post.title.ua || post.title.en || "Untitled post"}
                    </p>
                    <p className="text-xs text-white/40 mt-1">
                      {new Date(post.date).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded-full border ${
                      post.status === "published"
                        ? "border-emerald-400/40 text-emerald-300"
                        : "border-white/20 text-white/40"
                    }`}
                  >
                    {post.status}
                  </span>
                </div>
              </button>
            ))}
            {sortedPosts.length === 0 ? (
              <div className="p-6 text-xs text-white/40">No posts yet.</div>
            ) : null}
          </div>
        </aside>

        <section className="flex-1 overflow-y-auto">
          {!draft ? (
            <div className="p-10 text-white/40 text-sm">Select or create a post.</div>
          ) : (
            <div className="max-w-3xl px-6 py-8 space-y-8">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-widest text-white/40">Post editor</p>
                  <h2 className="text-2xl font-light text-white mt-2">
                    {draft.title.ua || draft.title.en || "Untitled"}
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePublishToggle}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
                      draft.status === "published"
                        ? "border-emerald-400/40 text-emerald-300"
                        : "border-white/20 text-white/50"
                    }`}
                  >
                    {draft.status === "published" ? "Published" : "Draft"}
                  </button>
                  <button
                    onClick={handleSavePost}
                    disabled={loading}
                    className="flex items-center gap-2 px-3 py-1.5 bg-white text-black rounded-full text-xs font-medium"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Save post
                  </button>
                  <button
                    onClick={() => handleDeletePost(draft.id)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-white/10 text-white rounded-full text-xs font-medium border border-white/10"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                </div>
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <label className="text-xs uppercase tracking-widest text-white/40">Title (UA)</label>
                  <input
                    value={draft.title.ua}
                    onChange={(e) => updateDraft({ title: { ...draft.title, ua: e.target.value } })}
                    className="mt-2 w-full rounded-lg border border-white/10 bg-zinc-900/40 px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-widest text-white/40">Title (EN)</label>
                  <input
                    value={draft.title.en}
                    onChange={(e) => updateDraft({ title: { ...draft.title, en: e.target.value } })}
                    className="mt-2 w-full rounded-lg border border-white/10 bg-zinc-900/40 px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-widest text-white/40">Date</label>
                  <input
                    type="date"
                    value={formatDateInput(draft.date)}
                    onChange={(e) =>
                      e.target.value
                        ? updateDraft({
                            date: new Date(e.target.value).toISOString(),
                          })
                        : null
                    }
                    className="mt-2 w-full rounded-lg border border-white/10 bg-zinc-900/40 px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-widest text-white/40">Slug</label>
                  <div className="mt-2 flex gap-2">
                    <input
                      value={draft.slug}
                      onChange={(e) => updateDraft({ slug: e.target.value })}
                      className="flex-1 rounded-lg border border-white/10 bg-zinc-900/40 px-3 py-2 text-sm text-white"
                    />
                    <button
                      onClick={handleGenerateSlug}
                      className="px-3 py-2 rounded-lg border border-white/10 text-xs text-white/70"
                    >
                      Auto
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs uppercase tracking-widest text-white/40">Caption (UA)</label>
                <textarea
                  value={draft.caption.ua}
                  onChange={(e) => updateDraft({ caption: { ...draft.caption, ua: e.target.value } })}
                  rows={5}
                  className="mt-2 w-full rounded-lg border border-white/10 bg-zinc-900/40 px-3 py-2 text-sm text-white"
                />
              </div>

              <div>
                <label className="text-xs uppercase tracking-widest text-white/40">Caption (EN)</label>
                <textarea
                  value={draft.caption.en}
                  onChange={(e) => updateDraft({ caption: { ...draft.caption, en: e.target.value } })}
                  rows={5}
                  className="mt-2 w-full rounded-lg border border-white/10 bg-zinc-900/40 px-3 py-2 text-sm text-white"
                />
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <label className="text-xs uppercase tracking-widest text-white/40">Location (UA)</label>
                  <input
                    value={draft.location?.ua ?? ""}
                    onChange={(e) =>
                      updateDraft({
                        location: { ...(draft.location ?? { ua: "", en: "" }), ua: e.target.value },
                      })
                    }
                    className="mt-2 w-full rounded-lg border border-white/10 bg-zinc-900/40 px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-widest text-white/40">Location (EN)</label>
                  <input
                    value={draft.location?.en ?? ""}
                    onChange={(e) =>
                      updateDraft({
                        location: { ...(draft.location ?? { ua: "", en: "" }), en: e.target.value },
                      })
                    }
                    className="mt-2 w-full rounded-lg border border-white/10 bg-zinc-900/40 px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs uppercase tracking-widest text-white/40">Tags</label>
                <input
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="auto, tuning, delivery"
                  className="mt-2 w-full rounded-lg border border-white/10 bg-zinc-900/40 px-3 py-2 text-sm text-white"
                />
              </div>

              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-white/40">Media</p>
                    <p className="text-xs text-white/40 mt-1">Upload images/videos or paste a URL.</p>
                  </div>
                  <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 text-xs text-white/70 cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    {uploading ? "Uploading..." : "Upload files"}
                    <input
                      type="file"
                      accept="image/*,video/*"
                      multiple
                      onChange={(e) => handleUploadMedia(e.target.files)}
                      className="hidden"
                    />
                  </label>
                </div>

                <div className="flex flex-wrap gap-2">
                  {draft.media.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2"
                    >
                      <span className="text-[10px] uppercase tracking-widest text-white/50">
                        {item.type}
                      </span>
                      <span className="text-xs text-white/70 max-w-[180px] truncate">
                        {item.src}
                      </span>
                      <button
                        onClick={() => handleRemoveMedia(item.id)}
                        className="text-white/40 hover:text-white"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  {draft.media.length === 0 ? (
                    <p className="text-xs text-white/40">No media yet.</p>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-900/40 px-3 py-2">
                    <select
                      value={newMediaType}
                      onChange={(e) => setNewMediaType(e.target.value as "image" | "video")}
                      className="bg-transparent text-xs text-white/70"
                    >
                      <option value="image">image</option>
                      <option value="video">video</option>
                    </select>
                    <input
                      value={newMediaUrl}
                      onChange={(e) => setNewMediaUrl(e.target.value)}
                      placeholder="https://..."
                      className="bg-transparent text-xs text-white/70 w-64"
                    />
                    <button
                      onClick={handleAddMediaUrl}
                      className="text-xs text-white/70"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleSavePost()}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/70"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Save post
                  </button>
                  <button
                    onClick={() => window.open(`/ua/blog/${draft.slug}`, "_blank")}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/70"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Preview
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
