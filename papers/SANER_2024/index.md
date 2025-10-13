---
title: "T-FREX: A Transformer-based Feature Extraction Method for Mobile App Reviews"
date: 2024-03-12T00:00:00Z
venue: SANER 2024
author: ["Quim Motger", "Alessio Miaschi", "Felice Dell'Orletta", "Xavier Franch", "Jordi Marco"]
summary: "Mobile app reviews are a large-scale data source for software-related knowledge generation activities, including software maintenance, evolution and feedback analysis. Effective extraction of features (i.e., functionalities or characteristics) from these reviews is key to support analysis on the acceptance of these features, identification of relevant new feature requests and prioritization of feature development, among others. Traditional methods focus on syntactic pattern-based approaches, typically context-agnostic, evaluated on a closed set of apps, difficult to replicate and limited to a reduced set and domain of apps. Meanwhile, the pervasiveness of Large Language Models (LLMs) based on the Transformer architecture in software engineering tasks lays the groundwork for empirical evaluation of the performance of these models to support feature extraction. In this study, we present T-FREX, a Transformer-based, fully automatic approach for mobile app review feature extraction. First, we collect a set of ground truth features from users in a real crowdsourced software recommendation platform and transfer them automatically into a dataset of app reviews. Then, we use this newly created dataset to fine-tune multiple LLMs on a named entity recognition task under different data configurations. We assess the performance of T-FREX with respect to this ground truth, and we complement our analysis by comparing T-FREX with a baseline method from the field. Finally, we assess the quality of new features predicted by T-FREX through an external human evaluation. Results show that T-FREX outperforms on average the traditional syntactic-based method, especially when discovering new features from a domain for which the model has been fine-tuned."

editPost:
    URL: "https://conf.researchr.org/home/saner-2024"
    Text: "Proceedings of The IEEE International Conference on Software Analysis, Evolution and Reengineering (SANER) 2024"

---

##### Download

+ [Paper](https://ieeexplore.ieee.org/document/10589848)

---

##### Abstract

Mobile app reviews are a large-scale data source for software-related knowledge generation activities, including software maintenance, evolution and feedback analysis. Effective extraction of features (i.e., functionalities or characteristics) from these reviews is key to support analysis on the acceptance of these features, identification of relevant new feature requests and prioritization of feature development, among others. Traditional methods focus on syntactic pattern-based approaches, typically context-agnostic, evaluated on a closed set of apps, difficult to replicate and limited to a reduced set and domain of apps. Meanwhile, the pervasiveness of Large Language Models (LLMs) based on the Transformer architecture in software engineering tasks lays the groundwork for empirical evaluation of the performance of these models to support feature extraction. In this study, we present T-FREX, a Transformer-based, fully automatic approach for mobile app review feature extraction. First, we collect a set of ground truth features from users in a real crowdsourced software recommendation platform and transfer them automatically into a dataset of app reviews. Then, we use this newly created dataset to fine-tune multiple LLMs on a named entity recognition task under different data configurations. We assess the performance of T-FREX with respect to this ground truth, and we complement our analysis by comparing T-FREX with a baseline method from the field. Finally, we assess the quality of new features predicted by T-FREX through an external human evaluation. Results show that T-FREX outperforms on average the traditional syntactic-based method, especially when discovering new features from a domain for which the model has been fine-tuned.

---

##### Citation

```BibTeX
@inproceedings{motger2024TFREX,
    title = "T-FREX: A Transformer-based Feature Extraction Method from Mobile App Reviews",
    author = "Motger, Quim and 
    Miaschi, Alessio  and
      Dell{'}Orletta, Felice  and
      Franch, Xavier and
      Jordi, Marco",
    booktitle = "Proceedings of The IEEE International Conference on Software Analysis, Evolution and Reengineering (SANER) 2024",
    month = mar,
    year = "2024",
    address = "Rovaniemi, Finland",
}




