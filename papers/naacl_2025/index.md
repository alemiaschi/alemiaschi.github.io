---
title: "Optimizing LLMs for Italian: Reducing Token Fertility and Enhancing Efficiency Through Vocabulary Adaptation"
date: 2025-04-10T00:00:00Z
venue: Findings of NAACL 2025
author: ["Luca Moroni", "Giovanni Puccetti", "Pere-Lluís Huguet Cabot", "Andrei Stefan Bejgu", "Alessio Miaschi", "Edoardo Barba", "Felice Dell'Orletta", "Andrea Esuli", "Roberto Navigli"]
summary: "An increasing number of pretrained Large Language Models (LLMs) are being released, though the majority are predominantly designed for English. While they can often handle other languages due to contamination or some degree of multilingual pretraining data, English-centric LLMs are not optimized for non-English languages. This leads to inefficient encoding (high token ‘fertility’) and slower inference times for those languages. In this work, we explore various vocabulary adaptation techniques to tailor English LLMs for the Italian language. We introduce Semantic Alignment Vocabulary Adaptation (SAVA), a novel method that learns neural mapping to accomplish vocabulary substitution, which achieve state-of-the-art performances on several downstream tasks. We adapted two LLMs: Mistral-7b-v0.1, reducing token fertility by 25%, and Llama-3.1-8b, optimizing the vocabulary and reducing the number of parameters by 1 billion. We show that, after the adaptation of the vocabulary, these models can recover their performances with a relatively limited stage of continual training on the target language. Finally, we test the adapted models' capabilities on several multi-choice and generative tasks."

editPost:
    URL: "https://2025.naacl.org/"
    Text: "Proceedings of the Findings of the 2025 Annual Conference of the Nations of the Americas Chapter of the ACL (Findings of NAACL 2025, Albuquerque, Nex Mexico)"

---

##### Download

+ [Paper](https://aclanthology.org/2025.findings-naacl.371.pdf)

---

##### Abstract

An increasing number of pretrained Large Language Models (LLMs) are being released, though the majority are predominantly designed for English. While they can often handle other languages due to contamination or some degree of multilingual pretraining data, English-centric LLMs are not optimized for non-English languages. This leads to inefficient encoding (high token ‘fertility’) and slower inference times for those languages. In this work, we explore various vocabulary adaptation techniques to tailor English LLMs for the Italian language. We introduce Semantic Alignment Vocabulary Adaptation (SAVA), a novel method that learns neural mapping to accomplish vocabulary substitution, which achieve state-of-the-art performances on several downstream tasks. We adapted two LLMs: Mistral-7b-v0.1, reducing token fertility by 25%, and Llama-3.1-8b, optimizing the vocabulary and reducing the number of parameters by 1 billion. We show that, after the adaptation of the vocabulary, these models can recover their performances with a relatively limited stage of continual training on the target language. Finally, we test the adapted models' capabilities on several multi-choice and generative tasks.

---
##### Citation

```BibTeX
@inproceedings{moroni-etal-2025-optimizing,
    title = "Optimizing {LLM}s for {I}talian: Reducing Token Fertility and Enhancing Efficiency Through Vocabulary Adaptation",
    author = "Moroni, Luca  and
      Puccetti, Giovanni  and
      Huguet Cabot, Pere-Llu{\'i}s  and
      Bejgu, Andrei Stefan  and
      Miaschi, Alessio  and
      Barba, Edoardo  and
      Dell{'}Orletta, Felice  and
      Esuli, Andrea  and
      Navigli, Roberto",
    editor = "Chiruzzo, Luis  and
      Ritter, Alan  and
      Wang, Lu",
    booktitle = "Findings of the Association for Computational Linguistics: NAACL 2025",
    month = apr,
    year = "2025",
    address = "Albuquerque, New Mexico",
    publisher = "Association for Computational Linguistics",
    url = "https://aclanthology.org/2025.findings-naacl.371/",
    pages = "6646--6660",
    ISBN = "979-8-89176-195-7",
    abstract = "The number of pretrained Large Language Models (LLMs) is increasing steadily, though the majority are designed predominantly for the English language. While state-of-the-art LLMs can handle other languages, due to language contamination or some degree of multilingual pretraining data, they are not optimized for non-English languages, leading to inefficient encoding (high token {\textquotedblleft}fertility{\textquotedblright}) and slower inference speed.In this work, we thoroughly compare a variety of vocabulary adaptation techniques for optimizing English LLMs for the Italian language, and put forward Semantic Alignment Vocabulary Adaptation (SAVA), a novel method that leverages neural mapping for vocabulary substitution. SAVA achieves competitive performance across multiple downstream tasks, enhancing grounded alignment strategies. We adapt two LLMs: Mistral-7B-v0.1, reducing token fertility by 25{\%}, and Llama-3.1-8B, optimizing the vocabulary and reducing the number of parameters by 1 billion. We show that, following the adaptation of the vocabulary, these models can recover their performance with a relatively limited stage of continual training on the target language. Finally, we test the capabilities of the adapted models on various multi-choice and generative tasks."
}


```

---
