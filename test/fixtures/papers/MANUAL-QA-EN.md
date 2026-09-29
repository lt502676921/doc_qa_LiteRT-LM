# English Document Q&A Manual Test Cases

17 cases for the five built-in PDFs. Each case contains a copy-ready English question, an expected answer, and the original passages that should support the answer.

These are expected results for manual testing; model inference has not been run for this checklist. All 33 evidence/location excerpts were checked against their stated PDF pages, with whitespace and typography normalized.

## How to test

1. Select the corresponding built-in document before asking its questions.
2. Copy only the **Question** into the chat; keep the expected answer and evidence for evaluation.
3. Compare answer meaning, numbers, and caveats. Exact wording is not required.
4. Click the answer citations. Confirm that the cited source text actually supports the claims and belongs to the selected document.
5. For cross-section cases, require supporting citations from at least two distinct PDF pages.

**Page numbers:** Physical PDF pages, starting at 1. They may differ from printed page numbers.

**Citation IDs:** IDs such as `[[S1]]` depend on the source blocks supplied in that run. This checklist gives expected passages and pages, not fixed citation IDs or a prediction of what the model will output. Equivalent passages elsewhere in the PDF are acceptable if they support the claims.

**Partial reading:** When only selected excerpts are supplied, an unsupported-answer response must say that the provided excerpts do not give the answer. It must not claim that the entire paper lacks the information.

**Visual questions:** The expected refusal applies to the current application, which supplies extracted text to the model. A figure caption supports its location, not its colors, arrows, or exact positions.

## Case index

| # | Document | Case ID | Type | Evidence pages |
| ---: | --- | --- | --- | --- |
| 01 | [bitcoin.pdf](bitcoin.pdf) | bitcoin-privacy | fact | 6 |
| 02 | [bitcoin.pdf](bitcoin.pdf) | bitcoin-proof-of-work | cross_section | 1, 3, 8 |
| 03 | [bitcoin.pdf](bitcoin.pdf) | bitcoin-unsupported | unsupported | No supporting passage expected |
| 04 | [attention.pdf](attention.pdf) | attention-dimensions | cross_section | 3, 5 |
| 05 | [attention.pdf](attention.pdf) | attention-bleu | fact | 1, 8 |
| 06 | [attention.pdf](attention.pdf) | attention-unsupported | unsupported | No supporting passage expected |
| 07 | [attention.pdf](attention.pdf) | attention-visual-only | visual_only | 3 |
| 08 | [mapreduce.pdf](mapreduce.pdf) | mapreduce-failure | fact | 4, 5 |
| 09 | [mapreduce.pdf](mapreduce.pdf) | mapreduce-reexecution | cross_section | 4, 5, 6 |
| 10 | [mapreduce.pdf](mapreduce.pdf) | mapreduce-unsupported | unsupported | No supporting passage expected |
| 11 | [gfs.pdf](gfs.pdf) | gfs-parameters | cross_section | 3, 5 |
| 12 | [gfs.pdf](gfs.pdf) | gfs-data-path | fact | 2, 3 |
| 13 | [gfs.pdf](gfs.pdf) | gfs-unsupported | unsupported | No supporting passage expected |
| 14 | [raft.pdf](raft.pdf) | raft-election | fact | 6 |
| 15 | [raft.pdf](raft.pdf) | raft-majorities | cross_section | 5, 6, 10, 11 |
| 16 | [raft.pdf](raft.pdf) | raft-unsupported | unsupported | No supporting passage expected |
| 17 | [raft.pdf](raft.pdf) | raft-visual-only | visual_only | 6 |

## Questions, expected answers, and original evidence

### 01. bitcoin-privacy

**Document:** [bitcoin.pdf](bitcoin.pdf)

**Question**

According to the paper, why should a new key pair be used for each transaction? Does this prevent all transaction linking? Cite the original text.

**Expected answer**

A new key pair helps prevent different transactions from being linked to a common owner. It does not eliminate all linking: multi-input transactions reveal that their inputs were owned by the same owner.

**Expected citation evidence**

PDF page 6 - 10. Privacy:

> a new key pair should be used for each transaction to keep them from being linked to a common owner.

PDF page 6 - 10. Privacy:

> Some linking is still unavoidable with multi-input transactions, which necessarily reveal that their inputs were owned by the same owner.

**Fail if**

- Claims that new keys guarantee complete anonymity or prevent all linking.

### 02. bitcoin-proof-of-work

**Document:** [bitcoin.pdf](bitcoin.pdf)

**Question**

Using the Introduction, Proof-of-Work, and Conclusion sections, explain how proof-of-work helps prevent double-spending and what security assumption it relies on. Cite at least two of these sections.

**Expected answer**

The network records a public, chronologically ordered transaction history using proof-of-work. Changing a past block requires redoing its work and the work of all subsequent blocks, then catching up with the honest chain. Security relies on honest nodes collectively controlling more CPU power than any cooperating attacker group; it is not a majority-of-node-count assumption.

**Expected citation evidence**

PDF page 1 - 1. Introduction:

> generate computational proof of the chronological order of transactions.

PDF page 1 - 1. Introduction:

> The system is secure as long as honest nodes collectively control more CPU power than any cooperating group of attacker nodes.

PDF page 3 - 4. Proof-of-Work:

> To modify a past block, an attacker would have to redo the proof-of-work of the block and all blocks after it and then catch up with and surpass the work of the honest nodes.

PDF page 8 - 12. Conclusion:

> using proof-of-work to record a public history of transactions

**Cross-section requirement:** Supporting citations must span at least 2 distinct PDF pages.

**Fail if**

- Substitutes a majority of nodes for a majority of CPU power.
- Cites only one page for the cross-section explanation.

### 03. bitcoin-unsupported

**Document:** [bitcoin.pdf](bitcoin.pdf)

**Question**

Does this paper provide Satoshi Nakamoto's real name and home address? Answer using only the document.

**Expected answer**

The paper does not provide a verified real name or home address for Satoshi Nakamoto.

**Expected citation evidence**

No supporting passage is expected for the requested information. Do not fabricate a citation or repurpose an unrelated passage as evidence.

**Acceptable answer when only excerpts were supplied**

The provided excerpts do not give a verified real name or home address for Satoshi Nakamoto.

**Fail if**

- Guesses an identity or an address.
- Treats the author byline, email, or website as proof of a real identity or home address.
- Invents a supporting citation.

### 04. attention-dimensions

**Document:** [attention.pdf](attention.pdf)

**Question**

How many layers do the encoder and decoder each have? What are the model dimension and the inner dimension of the feed-forward network? Cite both the architecture and feed-forward network descriptions.

**Expected answer**

The encoder and decoder each have 6 layers. The model dimension is d_model = 512, and the feed-forward network's inner dimension is d_ff = 2048.

**Expected citation evidence**

PDF page 3 - 3.1 Encoder and Decoder Stacks:

> The encoder is composed of a stack of N = 6 identical layers.

PDF page 3 - 3.1 Encoder and Decoder Stacks:

> The decoder is also composed of a stack of N = 6 identical layers.

PDF page 5 - 3.3 Position-wise Feed-Forward Networks:

> The dimensionality of input and output is dmodel = 512, and the inner-layer has dimensionality dff = 2048.

**Cross-section requirement:** Supporting citations must span at least 2 distinct PDF pages.

**Fail if**

- Confuses the 8 attention heads with the 6 encoder or decoder layers.
- Swaps 512 and 2048.
- Does not cite both pages 3 and 5 or equivalent supporting evidence on distinct pages.

### 05. attention-bleu

**Document:** [attention.pdf](attention.pdf)

**Question**

What BLEU scores does the abstract report for WMT 2014 English-to-German and English-to-French translation? Keep each score paired with the correct task and cite the text.

**Expected answer**

The abstract reports 28.4 BLEU for WMT 2014 English-to-German and 41.8 BLEU for WMT 2014 English-to-French.

**Expected citation evidence**

PDF page 1 - Abstract:

> Our model achieves 28.4 BLEU on the WMT 2014 English-to-German translation task

PDF page 1 - Abstract:

> On the WMT 2014 English-to-French translation task, our model establishes a new single-model state-of-the-art BLEU score of 41.8

**Fail if**

- Swaps the language pairs.
- Reports a different model's score from a results table.

### 06. attention-unsupported

**Document:** [attention.pdf](attention.pdf)

**Question**

Does this paper report the time to first token for Gemma 4 E4B in the current browser application? Answer using only the document.

**Expected answer**

The paper does not report a time-to-first-token measurement for Gemma 4 E4B in this browser application.

**Expected citation evidence**

No supporting passage is expected for the requested information. Do not fabricate a citation or repurpose an unrelated passage as evidence.

**Acceptable answer when only excerpts were supplied**

The provided excerpts do not report a time-to-first-token measurement for Gemma 4 E4B in this browser application.

**Fail if**

- Invents a latency value.
- Uses training time, GPU count, or translation benchmark results as browser inference latency.

### 07. attention-visual-only

**Document:** [attention.pdf](attention.pdf)

**Question**

Directly inspect Figure 1 and list the start point, end point, and color of every arrow. Do not infer them from the body text.

**Expected answer**

I only have extracted text, so I cannot directly inspect the arrows or their colors in Figure 1. The figure is on PDF page 3, but a complete list of its graphical connections requires visual input.

**Expected citation evidence**

No text citation can support the requested graphical details. The following caption may support figure location only:

PDF page 3 - Figure 1:

> Figure 1: The Transformer - model architecture.

**Fail if**

- Claims to have inspected the figure.
- Invents arrow colors or a complete list of graphical connections.
- Uses a figure caption citation as evidence of visual inspection.

### 08. mapreduce-failure

**Document:** [mapreduce.pdf](mapreduce.pdf)

**Question**

Why must completed map tasks be re-executed after a worker failure, while completed reduce tasks do not need to be re-executed? Explain the difference in output storage and cite the paper.

**Expected answer**

Completed map tasks must be re-executed because their output is stored on the failed worker's local disks and becomes inaccessible. Completed reduce tasks do not need to be re-executed because their output is stored in a global file system. In-progress map and reduce tasks on the failed worker are rescheduled.

**Expected citation evidence**

PDF page 4 - 3.3 Fault Tolerance / Worker Failure:

> Completed map tasks are re-executed on a failure because their output is stored on the local disk(s) of the failed machine and is therefore inaccessible.

PDF page 4 - 3.3 Fault Tolerance / Worker Failure:

> Completed reduce tasks do not need to be re-executed since their output is stored in a global file system.

PDF page 4 - 3.3 Fault Tolerance / Worker Failure:

> any map task or reduce task in progress on a failed worker is also reset to idle and becomes eligible for rescheduling.

**Fail if**

- Says all completed tasks must be rerun.
- Swaps the output storage locations.
- Says in-progress reduce tasks never need rescheduling.

### 09. mapreduce-reexecution

**Document:** [mapreduce.pdf](mapreduce.pdf)

**Question**

Compare task re-execution after worker failures with backup tasks near the end of a MapReduce job. What problem does each mechanism solve? Cite evidence from both sections.

**Expected answer**

Failure recovery reschedules work that was in progress or whose map output became inaccessible after a worker failed. Backup tasks address stragglers that delay job completion: near the end of a job, the master runs backup executions of remaining in-progress tasks and accepts whichever execution finishes first. Both use another execution, but their triggers are different.

**Expected citation evidence**

PDF page 4 - 3.3 Fault Tolerance / Worker Failure:

> Any map tasks completed by the worker are reset back to their initial idle state, and therefore become eligible for scheduling on other workers.

PDF page 6 - 3.6 Backup Tasks:

> When a MapReduce operation is close to completion, the master schedules backup executions of the remaining in-progress tasks.

PDF page 6 - 3.6 Backup Tasks:

> The task is marked as completed whenever either the primary or the backup execution completes.

**Cross-section requirement:** Supporting citations must span at least 2 distinct PDF pages.

**Fail if**

- Claims backup tasks are triggered only by worker crashes.
- Confuses a slow worker with a confirmed failed worker.
- Supports the comparison using only one page.

### 10. mapreduce-unsupported

**Document:** [mapreduce.pdf](mapreduce.pdf)

**Question**

Does this paper report the system's memory usage and inference speed in Chrome WebGPU? Answer using only the document.

**Expected answer**

The paper does not report memory usage or inference speed in Chrome WebGPU. Its cluster performance results are not browser WebGPU inference measurements.

**Expected citation evidence**

No supporting passage is expected for the requested information. Do not fabricate a citation or repurpose an unrelated passage as evidence.

**Acceptable answer when only excerpts were supplied**

The provided excerpts do not report memory usage or inference speed in Chrome WebGPU.

**Fail if**

- Invents browser memory or inference measurements.
- Reuses cluster throughput or job duration as WebGPU inference performance.

### 11. gfs-parameters

**Document:** [gfs.pdf](gfs.pdf)

**Question**

What are the GFS chunk size and the initial lease timeout? How can a lease be extended? Cite the original evidence for each.

**Expected answer**

The chunk size is 64 MB, and a lease has an initial timeout of 60 seconds. As long as the chunk is being mutated, the primary can request and typically receive extensions from the master indefinitely. Extension requests and grants are piggybacked on HeartBeat messages.

**Expected citation evidence**

PDF page 3 - 2.5 Chunk Size:

> We have chosen 64 MB, which is much larger than typical file system block sizes.

PDF page 5 - 3.1 Leases and Mutation Order:

> A lease has an initial timeout of 60 seconds.

PDF page 5 - 3.1 Leases and Mutation Order:

> as long as the chunk is being mutated, the primary can request and typically receive extensions from the master indefinitely.

PDF page 5 - 3.1 Leases and Mutation Order:

> These extension requests and grants are piggybacked on the HeartBeat messages regularly exchanged between the master and all chunkservers.

**Cross-section requirement:** Supporting citations must span at least 2 distinct PDF pages.

**Fail if**

- Reports 64 KB instead of 64 MB.
- Reports 60 minutes instead of 60 seconds.
- Claims a lease is always extended unconditionally.
- Cites only one page.

### 12. gfs-data-path

**Document:** [gfs.pdf](gfs.pdf)

**Question**

Must file data pass through the master when a client reads a file? What are the roles of the master and the chunkservers? Cite the paper.

**Expected answer**

No. The master manages metadata and supplies the chunk handle and replica locations. The client then reads file data directly from a chunkserver. Having a single master does not mean that all file data passes through it.

**Expected citation evidence**

PDF page 3 - 2.4 Single Master:

> Clients never read and write file data through the master.

PDF page 3 - 2.4 Single Master:

> The master replies with the corresponding chunk handle and locations of the replicas.

PDF page 3 - 2.4 Single Master:

> The client then sends a request to one of the replicas, most likely the closest one.

PDF page 3 - 2.6 Metadata:

> The master stores three major types of metadata: the file and chunk namespaces, the mapping from files to chunks, and the locations of each chunk's replicas.

**Fail if**

- Says file contents are routed through the master.
- Confuses metadata requests with the data transfer path.

### 13. gfs-unsupported

**Document:** [gfs.pdf](gfs.pdf)

**Question**

Does this paper provide a complete open-source repository URL and software installation commands for GFS? Use only the document.

**Expected answer**

The paper does not provide a complete open-source repository URL or installation commands for GFS.

**Expected citation evidence**

No supporting passage is expected for the requested information. Do not fabricate a citation or repurpose an unrelated passage as evidence.

**Acceptable answer when only excerpts were supplied**

The provided excerpts do not give a complete open-source repository URL or installation commands for GFS.

**Fail if**

- Invents a repository URL or installation commands.
- Substitutes HDFS or another system's installation instructions.

### 14. raft-election

**Document:** [raft.pdf](raft.pdf)

**Question**

How do randomized election timeouts reduce split votes in Raft? What example interval does the paper give, and is that interval mandatory for every deployment? Cite the text.

**Expected answer**

Randomized election timeouts spread out election starts, making it likely that one server times out, wins, and sends heartbeats before the others time out. Candidates also restart a randomized timeout for each election to reduce repeated split votes. The paper gives 150-300 ms as an example interval, not a mandatory interval for every deployment.

**Expected citation evidence**

PDF page 6 - 5.2 Leader election:

> election timeouts are chosen randomly from a fixed interval (e.g., 150-300ms).

PDF page 6 - 5.2 Leader election:

> This spreads out the servers so that in most cases only a single server will time out; it wins the election and sends heartbeats before any other servers time out.

PDF page 6 - 5.2 Leader election:

> Each candidate restarts its randomized election timeout at the start of an election

**Fail if**

- Claims 150-300 ms is required in all deployments.
- Claims randomized timeouts completely eliminate split votes.

### 15. raft-majorities

**Document:** [raft.pdf](raft.pdf)

**Question**

How does the majority requirement for a normal leader election differ from the requirement during joint consensus? Why is the joint-consensus requirement needed during a configuration change? Cite both parts of the paper.

**Expected answer**

Under a normal configuration, a candidate needs votes from a majority of the servers in the current cluster. During joint consensus, agreement for elections and entry commitment requires separate majorities of both the old and new configurations. This prevents the two configurations from making independent decisions and avoids two leaders being elected for the same term during a transition.

**Expected citation evidence**

PDF page 6 - 5.2 Leader election:

> A candidate wins an election if it receives votes from a majority of the servers in the full cluster for the same term.

PDF page 10 - 6 Cluster membership changes:

> the cluster can potentially split into two independent majorities during the transition

PDF page 11 - 6 Cluster membership changes:

> Agreement (for elections and entry commitment) requires separate majorities from both the old and new configurations.

**Cross-section requirement:** Supporting citations must span at least 2 distinct PDF pages.

**Fail if**

- Requires only a majority of the union of old and new servers.
- Says a majority of either configuration alone is sufficient during joint consensus.
- Cites only one page.

### 16. raft-unsupported

**Document:** [raft.pdf](raft.pdf)

**Question**

Does this paper give a formal ISO standard number for the Raft algorithm? Use only the document.

**Expected answer**

The paper does not provide a formal ISO standard number for the Raft algorithm.

**Expected citation evidence**

No supporting passage is expected for the requested information. Do not fabricate a citation or repurpose an unrelated passage as evidence.

**Acceptable answer when only excerpts were supplied**

The provided excerpts do not give a formal ISO standard number for the Raft algorithm.

**Fail if**

- Invents a standard number.
- Confuses a bibliography number or section number with an ISO standard.

### 17. raft-visual-only

**Document:** [raft.pdf](raft.pdf)

**Question**

Inspect Figure 6 and describe the exact color and two-dimensional position of every box. Do not supplement the answer with body text.

**Expected answer**

I only have extracted text, so I cannot directly inspect the colors or exact two-dimensional positions of the boxes in Figure 6. The figure is on PDF page 6, but answering this requires visual input.

**Expected citation evidence**

No text citation can support the requested graphical details. The following caption may support figure location only:

PDF page 6 - Figure 6:

> Figure 6: Logs are composed of entries, which are numbered sequentially.

**Fail if**

- Claims to have inspected the colors or box positions.
- Presents information from the body text as direct visual observation.
- Treats the figure caption as evidence of graphical details.

## Manual result log

| Case ID | Answer correct | Evidence supports answer | Citations open correctly | Scope / capability boundary correct | First token / total time | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| bitcoin-privacy | | | | | | |
| bitcoin-proof-of-work | | | | | | |
| bitcoin-unsupported | | | | | | |
| attention-dimensions | | | | | | |
| attention-bleu | | | | | | |
| attention-unsupported | | | | | | |
| attention-visual-only | | | | | | |
| mapreduce-failure | | | | | | |
| mapreduce-reexecution | | | | | | |
| mapreduce-unsupported | | | | | | |
| gfs-parameters | | | | | | |
| gfs-data-path | | | | | | |
| gfs-unsupported | | | | | | |
| raft-election | | | | | | |
| raft-majorities | | | | | | |
| raft-unsupported | | | | | | |
| raft-visual-only | | | | | | |

The five classic papers may be familiar to the model. A correct answer alone does not prove document grounding; inspect the actual source citations.
