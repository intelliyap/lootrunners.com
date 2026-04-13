"use client";

import { useState } from "react";
import Markdown from "react-markdown";
import { sortedPosts, BlogPost } from "@/content/blog/posts";
import styles from "./Blog.module.css";

export const BLOG_WIDTH = 700;

export function Blog({ id: _id }: { id: string }) {
  const [selectedSlug, setSelectedSlug] = useState(
    sortedPosts[0]?.slug || ""
  );

  const selectedPost = sortedPosts.find((p) => p.slug === selectedSlug);

  return (
    <div className={styles.blogContainer}>
      <div className={styles.contentWrapper}>
        <div className={styles.sidebar}>
          <div className={styles.sidebarTitle}>Posts</div>
          <ul className={styles.postList}>
            {sortedPosts.map((post) => (
              <li
                key={post.slug}
                className={
                  selectedSlug === post.slug ? styles.selectedPost : ""
                }
                onClick={() => setSelectedSlug(post.slug)}
              >
                <div className={styles.postTitle}>{post.title}</div>
                <div className={styles.postDate}>{post.date}</div>
              </li>
            ))}
          </ul>
        </div>
        <div className={styles.mainContent}>
          {selectedPost ? (
            <PostView post={selectedPost} />
          ) : (
            <p>Select a post from the list.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function PostView({ post }: { post: BlogPost }) {
  return (
    <article>
      <h2 className={styles.postHeading}>{post.title}</h2>
      <div className={styles.postMeta}>{post.date}</div>
      <div className={styles.markdown}>
        <Markdown>{post.content}</Markdown>
      </div>
    </article>
  );
}
