# Third-party components

Bloop extends DeepSeek Harness (MIT), pinned in `harness.json`. Source changes are stored in `patches/bloop-harness.patch`; the upstream copyright and license are included in `deepseek-harness-LICENSE`.

The animated companion uses jeremy-prt/bloub (MIT), with its license in `bloub-LICENSE` and a pinned provenance notice embedded in the Harness patch. Third-party trademarks are not endorsements.

The reference project gzh-design-skill was reviewed but its AGPL implementation was not copied into this repository.

Bloop-authored code and changes have a separate licensing scope described in the repository's [LICENSE](../LICENSE) and [NOTICE.md](../NOTICE.md). That scope does not replace the MIT licenses above, revoke upstream grants, or relicense any other third-party dependencies.

The desktop settings service uses js-yaml (MIT) to preserve existing model provider settings; its package retains its own license in the installed dependencies.

Bloop's editorial guidance and new inline component examples were authored for this project after reviewing these public design-method references: [gzh-design-skill](https://github.com/isjiamu/gzh-design-skill), [wechat-article-studio-skill](https://github.com/LostSirius/wechat-article-studio-skill/blob/main/guides/layout.md), [baoyu article illustrator](https://github.com/JimLiu/baoyu-skills/blob/main/skills/baoyu-article-illustrator/SKILL.md), [Impeccable](https://github.com/pbakaus/impeccable), and [Anthropic frontend-design](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md). They informed topic selection, progressive reference loading, image planning and bounded visual review; no external skill runtime or renderer is bundled by this change.
