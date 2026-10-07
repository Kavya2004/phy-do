// ── Session-level co-usage tracker ───────────────────────────────────────────
// Tracks which features a student uses within a single page session, detects
// feature pairs (co-usage), multimodal mode, and fires one 'session_ended'
// event to Vercel on page unload.  Safe to load before all other scripts.

window.sessionTracker = (() => {
  const startTime   = Date.now();
  const featuresUsed = new Set();   // unique feature buckets active this session
  const sequence     = [];          // [{feature, t}]  t = seconds from session start

  /**
   * Record a feature interaction.
   * Called automatically by track() in tutor-chat.js via the featureMap.
   * @param {string} feature  e.g. 'chat', 'whiteboard', 'voice'
   */
  function use(feature) {
    featuresUsed.add(feature);
    sequence.push({
      feature,
      t: Math.round((Date.now() - startTime) / 1000)
    });
  }

  /**
   * Derive common sequential pairs from the sequence array.
   * e.g. [chat, whiteboard, chat, quiz] → 'chat→whiteboard, whiteboard→chat, chat→quiz'
   */
  function buildSequencePairs() {
    const pairs = [];
    for (let i = 0; i < sequence.length - 1; i++) {
      const a = sequence[i].feature;
      const b = sequence[i + 1].feature;
      if (a !== b) pairs.push(`${a}→${b}`);
    }
    // deduplicate
    return [...new Set(pairs)].join(',');
  }

  /**
   * Flush session summary to Vercel Analytics on page unload.
   */
  function flush() {
    const duration = Math.round((Date.now() - startTime) / 1000);
    const features = [...featuresUsed];

    // Co-usage pairs (unordered, e.g. 'chat+whiteboard')
    const coPairs = [];
    for (let i = 0; i < features.length; i++)
      for (let j = i + 1; j < features.length; j++)
        coPairs.push(`${features[i]}+${features[j]}`);

    // Multimodal mode label
    const has = f => features.includes(f);
    const modality =
      features.length >= 3          ? 'fully_multimodal'  :
      has('whiteboard')              ? 'text_whiteboard'   :
      has('voice')                   ? 'text_voice'        :
      has('file')                    ? 'text_file'         :
      has('quiz')                    ? 'text_quiz'         :
      has('notes') || has('summary') ? 'text_notes'        :
                                       'text_only';

    if (window.va) {
      window.va('event', {
        name: 'session_ended',
        data: {
          modality,
          feature_count: features.length,
        }
      });
    }
  }

  window.addEventListener('beforeunload', flush);

  return { use };
})();
