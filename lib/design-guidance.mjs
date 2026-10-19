import { readFile } from 'node:fs/promises';

// Only shipped editorial references are readable through the design tool.
export const DESIGN_REFERENCES = Object.freeze({
  index: 'theme-index.md',
  components: 'editorial-components.md',
  editorial: 'theme-editorial.md',
  warm: 'theme-warm.md',
  brief: 'theme-brief.md',
  campus: 'theme-campus-literary.md',
  visual_story: 'visual-story.md',
  images: 'image-direction.md',
  review: 'editorial-review.md',
  structure: 'article-structure.md',
  title: 'title-card.md',
  poster: 'title-poster.md',
  image_recipes: 'image-recipes.md',
  constraints: 'wechat-constraints.md',
});

/** Returns one bundled reference, never an arbitrary filesystem path. */
export async function readDesignReference(topic) {
  if (!Object.hasOwn(DESIGN_REFERENCES, topic)) throw new Error('未知设计参考，请使用工具列出的 topic。');
  return readFile(new URL(`../.agents/skills/gzh-design/references/${DESIGN_REFERENCES[topic]}`, import.meta.url), 'utf8');
}
