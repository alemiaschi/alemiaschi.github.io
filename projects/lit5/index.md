---
title: "Linguistically Informed T5"
summary: "Suite of linguistically-informed T5 models"
tags: ["t5", "language model"]
date: 2024-05-20

cover:
    image: "featured.png"

---

### Description

This repository contains data and models associated to the LREC-COLING 2024 paper <a href='https://aclanthology.org/2024.lrec-main.922.pdf'>"Linguistic Knowledge Can Enhance Encoder-Decoder Models (If You Let It)"</a>. <br>
<b>Abstract</b>: In this paper, we explore the impact of augmenting pre-trained Encoder-Decoder models, specifically T5, with linguistic knowledge for the prediction of a target task. In particular, we investigate whether fine-tuning a T5 model on an intermediate task that predicts structural linguistic properties of sentences modifies its performance in the target task of predicting sentence-level complexity. Our study encompasses diverse experiments conducted on Italian and English datasets, employing both monolingual and multilingual T5 models at various sizes. Results obtained for both languages and in cross-lingual configurations show that linguistically motivated intermediate fine-tuning has generally a positive impact on target task performance, especially when applied to smaller models and in scenarios with limited data availability.

### View
+ [GitHub Repository](https://github.com/alemiaschi/linguistically_informed_t5)
+ [Paper](https://aclanthology.org/2024.lrec-main.922.pdf)
