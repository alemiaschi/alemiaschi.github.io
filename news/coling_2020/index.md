---
title: COLING 2020 Paper
event: COLING 2020 (December 8-13, 2020)
event_url: https://coling2020.org/

location:  The 28th International Conference on Computational Linguistics.

cover:
    image: "featured.png"
    
# Talk start and end times.
#   End time can optionally be hidden by prefixing the line with `#`.
date_event: "2020-02-08T13:00:00Z"
date: "2020-09-30"
all_day: true

# Schedule page publish date (NOT talk date).
publishDate: "2020-09-30T00:00:00Z"

---

Our paper 'Linguistic Profiling of a Neural Language Model' (with Dominique Brunato, Felice Dell'Orletta and Giulia Venturi) has been accepted at COLING 2020! In this paper we investigate the linguistic knowledge learned by a Neural Language Model (BERT) before and after a fine-tuning process and how this knowledge affects its predictions during several classification problems. We use a wide set of probing tasks, each of which corresponds toa distinct sentence-level feature extracted from different levels of linguistic annotation. In particular, we showed that BERT encodes a wide range of linguistic properites, but the order in which they are stored in the internal representations does not necessarily reflect the traditional division with respect to the linguistic annotation levels. <img src='1.png'><br/> We also found that BERT tends to lose its precision in encoding linguistic features after a fine-tuning process (Native Language Identification), probably because it is storing more task–related information for solving the task. <img src='2.png'><br/> Finally, we showed that the implicit linguistic knowledge encoded by the NLM positively affects its ability to solve the tested downstream tasks. <img src='3.png'>
