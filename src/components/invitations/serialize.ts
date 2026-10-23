import type { TimelinePost } from "@/lib/services/posts";
import type { PostView } from "./PostCard";
/** Server → client props (dates as ISO strings). */
export const toView = (p: TimelinePost): PostView => ({
  id: p.id, imageKey: p.imageKey, width: p.width, height: p.height, caption: p.caption, createdAt: p.createdAt.toISOString(),
  author: p.author, likeCount: p.likeCount, commentCount: p.commentCount, liked: p.liked,
  comments: p.comments.map((c) => ({ id: c.id, body: c.body, createdAt: c.createdAt.toISOString(), author: c.author })),
});
