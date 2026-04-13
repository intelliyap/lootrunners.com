"use client";

import { useState } from "react";
import Markdown from "react-markdown";
import { sortedPosts, BlogPost } from "@/content/blog/posts";
import styles from "./Blog.module.css";

export const BLOG_WIDTH = 700;

function readingTime(content: string): string {
  const words = content.trim().split(/\s+/).length;
  const minutes = Math.max(1, Math.ceil(words / 200));
  return `${minutes} min read`;
}

export function Blog({ id: _id }: { id: string }) {
  const [selectedSlug, setSelectedSlug] = useState(
    sortedPosts[0]?.slug || ""
  );
  const [showList, setShowList] = useState(true);

  const selectedPost = sortedPosts.find((p) => p.slug === selectedSlug);

  return (
    <div className={styles.blogContainer}>
      <div className={styles.contentWrapper}>
        <div
          className={styles.sidebar}
          style={{ display: showList ? undefined : "none" }}
        >
          <div className={styles.sidebarTitle}>Posts</div>
          <ul className={styles.postList}>
            {sortedPosts.map((post) => (
              <li
                key={post.slug}
                className={
                  selectedSlug === post.slug ? styles.selectedPost : ""
                }
                onClick={() => {
                  setSelectedSlug(post.slug);
                  setShowList(false);
                }}
              >
                <div className={styles.postTitle}>{post.title}</div>
                <div className={styles.postDate}>
                  {post.date} &middot; {post.author}
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div
          className={styles.mainContent}
          style={{ display: !showList || typeof window === "undefined" || window.innerWidth > 768 ? undefined : "none" }}
        >
          {selectedPost ? (
            <PostView
              post={selectedPost}
              onBack={() => setShowList(true)}
            />
          ) : (
            <p>Select a post from the list.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function PostView({ post, onBack }: { post: BlogPost; onBack: () => void }) {
  return (
    <article>
      <button className={styles.backButton} onClick={onBack}>
        &larr; Posts
      </button>
      <h2 className={styles.postHeading}>{post.title}</h2>
      <div className={styles.postMeta}>
        <span>{post.author}</span>
        <span>&middot;</span>
        <span>{post.date}</span>
        <span>&middot;</span>
        <span>{readingTime(post.content)}</span>
      </div>
      {post.tags.length > 0 && (
        <div className={styles.tags}>
          {post.tags.map((tag) => (
            <span key={tag} className={styles.tag}>
              {tag}
            </span>
          ))}
        </div>
      )}
      <div className={styles.markdown}>
        <Markdown
          components={{
            img: ({ src, alt }) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={src}
                alt={alt || ""}
                className={styles.postImage}
                loading="lazy"
              />
            ),
          }}
        >
          {post.content}
        </Markdown>
      </div>
    </article>
  );
}
