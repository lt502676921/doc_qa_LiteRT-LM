# 文档测试样例

内置 5 份 PDF，合计 3,433,721 字节（约 3.27 MiB）。保留原 PDF 的作者署名及文档内权利声明；`UPSTREAM-LICENSE.txt` 保留样例集合的授权声明，论文原始来源另列于清单。

这些文件既用于开发测试，也可在首页“Try a built-in document”中直接选择；上传入口仍可使用自己的文件。开发服务和生产构建均提供这五份内置样例，部署包增加约 3.27 MiB，点击后才加载对应 PDF。

| 文件 | 页数 | 优先测试内容 | 原始来源 |
| --- | ---: | --- | --- |
| [bitcoin.pdf](bitcoin.pdf) | 9 | 短文问答、跨章节解释、隐私段落、文本与图形能力边界 | [Bitcoin](https://bitcoin.org/bitcoin.pdf) |
| [attention.pdf](attention.pdf) | 15 | 数值对应、模型架构、表格与公式提取 | [arXiv](https://arxiv.org/pdf/1706.03762) |
| [gfs.pdf](gfs.pdf) | 15 | 长文预算、双栏顺序、参数、控制路径与数据路径 | [Google Research](https://static.googleusercontent.com/media/research.google.com/en//archive/gfs-sosp2003.pdf) |
| [mapreduce.pdf](mapreduce.pdf) | 13 | 双栏顺序、伪代码、故障恢复、跨章节比较 | [Google Research](https://static.googleusercontent.com/media/research.google.com/en//archive/mapreduce-osdi04.pdf) |
| [raft.pdf](raft.pdf) | 18 | 长文预算、跨章节推理、选举与配置切换 | [Raft](https://raft.github.io/raft.pdf) |

页码统一指 PDF 文件从 1 开始的物理页码，可能与正文印刷页码不同。

## 自动解析检查

在项目目录执行：

```sh
pnpm test:papers
```

使用项目已安装的 officeparser，关闭 OCR 和附件提取，检查：

- 文件大小与 SHA-256，确保样例与原始引入版本一致。
- PDF 页数、连续真实页码，以及每页是否提取到文本。
- 已知证据是否仍出现在对应页，例如 GFS 的 64 MB、60 seconds。
- 提取文本是否明显减少；长度阈值允许正常排版变化，不要求逐字符一致。
- 问答用例中的文档关联和参考页范围是否有效。

该命令验证 Node 环境的文件完整性及解析基线，不启动模型推理、不下载模型，不代表浏览器 worker、GPU 推理或模型回答已经通过。

## 浏览器问答检查

`qa-cases.json` 包含 17 个中文问题及人工验收标准，覆盖事实、跨章节、文档无答案和纯文本无法解读的图形问题。按顺序先测试 Bitcoin，再测试 Attention、MapReduce、GFS、Raft。

对每个问题记录：模型/上下文配置、读取范围、答案、引用、首 token 时间、总耗时、是否取消/失败。建议结果表：

| 用例 ID | 配置与读取范围 | 事实正确 | 原文支持 | 引用可定位 | 能力边界正确 | 首 token / 总耗时 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| bitcoin-privacy | | | | | | | |

事实题检查 `expectedPoints` 的含义，不要求回答逐字相同；`referencePages` 是已核对的参考位置，不是所有可能有效来源的完整列表。跨章节题还应满足 `minimumDistinctEvidencePages`，避免只引用摘要却宣称比较了多个部分。

无答案题需要明确说明文档未提供，不用外部知识补齐；只读取相关片段时，应限定为“当前片段未提供”，不能断言整篇不存在。

图形题需要披露当前没有视觉输入。图的标题或文字被提取出来，不等于已经观察到颜色、箭头和空间关系。

当前应用已实现物理页来源、点击定位、上下文预算和相关片段选择。长文概览使用分批摘要并显示覆盖进度。引用验证只保证来源 ID 属于实际输入，事实是否被原文支持仍需人工核验。长文超限提示本身可以是正确行为；不要只追求五份文档都能强行全文生成。

## 测试集边界

这五份都是经典英文论文，模型可能已经记住部分内容。因此“答对”不能单独证明模型读取了上传文件：应逐条检查引用是否指向本轮提供的证据。

后续可补充带明确标记的合成事实文件，测试开头/中间/结尾取证，并增加中文、Office 文件、扫描件和混合 PDF。本样例集不覆盖这些格式，也不能替代设备实测。

自动解析通过也不代表多栏阅读顺序、公式和表格全部正确。MapReduce 与 Raft 的提取文本可出现栏间交错，需在浏览器中对照原 PDF 人工检查。
