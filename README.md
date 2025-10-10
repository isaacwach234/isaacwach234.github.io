# **Danbooru Tag Helper**

A web-based utility designed primarily to **streamline the process of tagging**, particularly those using Danbooru-style conventions. It's also helpful for managing, refining, and formatting tags for AI image generation prompts.

This tool allows you to easily process lists of tags by applying various filters, formatting options, and additions, making dataset management more efficient.

## **Features**

* **Tag Input:** Enter or paste comma-separated tags.  
* **Blacklisting:** Exclude tags containing specific keywords.  
* **Trigger Word Prepending:** Add custom words or phrases to the beginning of your tag list (useful for prompts or specific dataset categorizations).  
  * **Uniquify Option:** Apply simple character substitutions (e.g., e-\>3, s-\>5) to trigger words for potential variation.  
* **Append Tags:** Add custom words or phrases to the end of your tag list.  
* **Tag Formatting:** Automatically replace spaces with underscores (or vice-versa) for consistency.  
* **Sorting:** Sort the processed tags alphabetically (A-Z or Z-A) or keep the original order (after filtering).
* **Illustrious Prompt Ordering:** Apply the community Illustrious structure (Artist → Subject → Pose → Scene → Effects → Quality) with a single sort mode.
* **Max Tag Limit:** Limit the number of processed tags included in the final output per item.
* **Tag Search:** Highlight or count tags matching a search term within the processed or original input list, aiding in review.  
* **Clear Display:** Shows initial tag count, processed tag count, prepended triggers, and appended tags separately.  
* **Copy to Clipboard:** Easily copy the final formatted tag list (including triggers, processed tags, and appended tags) for use in dataset files or prompts.

## **How to Use**

1. **Input Tags:** Paste or type the comma-separated tags for a dataset item (or prompt) into the "Enter tags" text area.  
2. **Configure Options:**  
   * Add any tags/words to the **Blacklist** text area to exclude them from the final set.  
   * Enter desired **Prepend Trigger Words** if needed for categorization or prompts. Check "Uniquify Triggers" if desired.  
   * Enter desired **Append Tags** for consistent additions (like quality tags or dataset identifiers).  
   * Use the checkboxes and dropdowns to select **Underscores**, **Sort Order**, and **Max Tags** per item.  
   * Use the **Search** bar and dropdown to find specific tags during review.  
3. **Review Output:** The "Processed Tags", "Trigger Words", and "Append Tags" sections will update automatically, showing the refined tag list.  
4. **Copy:** Click the "Copy All Tags" button to copy the combined result (Triggers \+ Processed \+ Appends) to your clipboard for pasting into your dataset annotation file or application.

## **Live Demo**

You can try the tool live here: [https://https://isaacwach234.github.io/](https://isaacwach234.github.io/)
