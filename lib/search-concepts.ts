/**
 * 中文需求搜索的词汇表。三类：
 *   1. CONCEPTS     概念 → 中文/英文表面形式（同义扩展，跨语言）
 *   2. STOPWORDS    疑问/祈使/功能词 + 笔记正文里的套话，不参与匹配
 *   3. GENERIC      有信息量但太常见的词，保留但降权
 *
 * 说明：所有 surface 一律小写；同一 surface 只能出现在一个概念里（启动时由
 * scripts/eval-search.js 的 --lint 检查重复）。多字 surface 同时充当「分词后合并」词典，
 * 用来修复 Intl.Segmenter 切碎固定搭配的问题（开源 → 开 / 源，低代码 → 低 / 代码）。
 */

/** 概念标签 → 表面形式（第 1 个最常用，用于展示和主命中判断）。 */
export const CONCEPTS: Record<string, string[]> = {
  爬虫采集: ['爬虫', '爬取', '抓取', '采集', '抓取器', 'crawler', 'crawl', 'scraper', 'scrape', 'spider'],
  数据可视化: ['可视化', '图表', '仪表盘', '看板', 'visualizer', 'visualization', 'chart', 'charts', 'dashboard', 'dashboards'],
  数据分析: ['数据分析', '数据科学', '数据挖掘', 'analytics', 'pandas', 'polars'],
  大模型: ['大模型', '大语言模型', '语言模型', '基础模型', 'llm', 'llms', 'foundation model'],
  微调训练: ['微调', '训练', '训练模型', '预训练', 'finetune', 'fine-tune', 'finetuning', 'lora', 'sft'],
  推理服务: ['推理', '推理引擎', '推理服务', 'inference', 'serving', '吞吐'],
  语音: ['语音', '音色', '配音', '听写', '转录', '音频', '声音', '语音合成', '有声书', '克隆音色', '克隆', 'voice', 'speech', 'tts', 'asr', 'whisper'],
  视频: ['视频', '剪辑', '成片', '短视频', '视频生成', '文生视频', 'video', 'videos', '影片'],
  音乐: ['音乐', '歌词', '翻唱', '播放器', 'music', '歌曲'],
  图像: ['图像', '图片', '视觉', '截图', '文生图', '图像生成', '绘图', 'image', 'images', 'vision', 'stable diffusion'],
  三维渲染: ['3d', '三维', '渲染', '建模', 'render', 'rendering', 'webgl'],
  动画: ['动画', '动效', '特效', 'animation', 'animations', '动画引擎'],
  前端: ['前端', '网页', '界面', '页面', '网站', 'frontend', 'web', 'ui', 'website'],
  后台管理: ['后台', '管理后台', '管理面板', '内部工具', '企业管理', 'admin', 'admin panel', 'erp', 'crm', 'hrm'],
  低代码: ['低代码', '无代码', '可视化搭建', 'low-code', 'lowcode', 'no-code', 'nocode'],
  组件库: ['组件库', '组件', '设计系统', 'component', 'components', 'design system', 'ui 库'],
  设计: ['设计', '设计师', '创意', 'design', 'designer'],
  笔记: ['笔记', '笔记软件', '个人知识', '知识管理', '记事', '整理', '笔记本', 'notebooklm', 'notion', 'obsidian', 'note', 'notes', 'notebook', 'notebooks'],
  知识库: ['知识库', '知识', 'wiki', 'knowledge base', 'knowledge'],
  搜索: ['搜索', '检索', '搜索引擎', '全文检索', '向量检索', '语义搜索', 'search', 'retrieval', 'semantic search'],
  rag问答: ['rag', '检索增强', '问答', '知识问答', 'retrieval augmented'],
  记忆: ['记忆', '长期记忆', '上下文', '会话', 'memory', 'memories', 'context'],
  智能体: ['agent', 'agents', '智能体', '代理', '助手', 'agentic', 'bot', 'bots'],
  人工智能: ['ai', '人工智能', 'agi', '机器学习', '深度学习', 'machine learning'],
  mcp: ['mcp', 'model context protocol', 'mcp server', 'mcp服务'],
  编码工具: ['编码', '编程', '代码', '写代码', 'coding', 'code', 'coding agent'],
  命令行: ['命令行', '终端', '脚本', 'cli', 'terminal', 'shell', 'command line'],
  编辑器: ['编辑器', '插件', '扩展', 'editor', 'ide', 'vscode', 'plugins', 'extension'],
  浏览器: ['浏览器', 'browser', 'chrome', 'chromium', '浏览器扩展'],
  浏览器自动化: ['浏览器自动化', 'playwright', 'puppeteer', 'selenium', '自动化测试工具'],
  桌面应用: ['桌面', '桌面端', '跨平台', 'desktop', 'electron', 'macos', 'windows', 'linux'],
  移动应用: ['移动端', '手机', '安卓', 'android', 'ios'],
  自动化: ['自动化', '自动', '工作流', '编排', '流水线', '批量', '定时', 'automation', 'workflow', 'workflows', 'pipeline', 'pipelines'],
  测试: ['测试', '测试框架', '单元测试', '端到端', 'test', 'tests', 'testing', 'e2e'],
  部署: ['部署', '上线', '发布', '托管', '自托管', 'deploy', 'deployment', 'hosting', 'self-hosted', 'self-host'],
  容器云原生: ['容器', '容器镜像', '云原生', '集群', 'docker', 'kubernetes', 'k8s', 'gitops', 'cncf'],
  监控观测: ['监控', '监测', '观测', '可观测性', '告警', '追踪', 'monitor', 'monitoring', 'observability', 'tracing'],
  安全: ['安全', '漏洞', '攻击', '防护', '加密', '认证', 'security', 'vulnerability', 'cve'],
  渗透测试: ['渗透', '渗透测试', '红队', '黑客', 'pentest', 'penetration testing', 'hacking', 'red team'],
  逆向工程: ['逆向', '逆向工程', '反向工程', '反编译', '反汇编', '二进制', 'reverse engineering', 'reverse-engineering', 'ghidra'],
  隐私离线: ['隐私', '本地优先', '离线', '离网', '端侧', '本地运行', 'privacy', 'local-first', 'offline', 'on-device'],
  数据库: ['数据库', '向量数据库', '存储', 'database', 'databases', 'sql', 'key-value'],
  股票金融: ['股票', '量化', '选股', '回测', '盯盘', '交易', '金融', '投资', '对冲', 'trading', 'backtest'],
  教程学习: ['教程', '课程', '学习', '指南', '入门', '从零', '教学', 'tutorial', 'tutorials', 'course', 'courses', 'learning', 'guide'],
  面试: ['面试', '简历', '刷题', '求职', 'interview', 'interviews', 'resume'],
  游戏: ['游戏', '小游戏', 'game', 'games', 'gaming'],
  性能: ['性能', '高性能', '加速', '优化', '基准', '评测', '压测', 'benchmark', 'performance', 'optimization'],
  下载: ['下载', '下载器', '磁力', '种子', 'download', 'downloader', 'torrent'],
  生成式界面: ['生成式', '生成式ui', '界面生成', 'ai界面', 'generative', 'generative ui'],
  技能: ['技能', '技能库', '技能包', 'skill', 'skills'],
  提示词: ['提示词', '提示工程', '上下文工程', 'prompt', 'prompts', 'prompt engineering'],
  数据集: ['数据集', '语料', '数据源', 'dataset', 'datasets', 'corpus'],
  文字识别: ['文字识别', '文档识别', '扫描件', 'ocr', 'text recognition'],
  文档处理: ['文档', '文档转换', '文档处理', '格式转换', 'pdf', 'docx', 'markdown'],
  文件管理: ['文件', '文件管理', '同步', '备份', '网盘', 'file', 'files', 'sync', 'backup'],
  翻译: ['翻译', '多语言', '字幕', '转写', 'translate', 'translation', 'subtitles'],
  写作: ['写作', '文案', '文章', '小说', '网文', '内容创作', 'writing', 'writer'],
  表格: ['表格', '电子表格', 'spreadsheet', 'excel', 'csv'],
  演示文稿: ['幻灯片', '演示文稿', '汇报', 'ppt', 'slides', 'powerpoint'],
  硬件嵌入式: ['硬件', '嵌入式', '单片机', '物联网', 'hardware', 'embedded', 'iot', 'arduino', '树莓派'],
  网络工具: ['网络', '网关', '隧道', 'http', 'proxy', 'gateway', 'tunnel'],
  建站博客: ['建站', '静态站点', '博客', '文档站点', 'blog', 'static site', 'ssg'],
  聊天对话: ['聊天', '对话', '聊天机器人', 'chat', 'chatbot', 'conversational'],
  知识图谱: ['知识图谱', '图谱', 'knowledge graph'],
  生活应用: ['菜谱', '食谱', '烹饪', '记账', '日历', '待办', '旅行', '健身', '健康', '天气', 'recipe', 'recipes', 'meal', 'meals'],
  数学科学: ['数学', '科学', '物理', '化学', '生物', 'math', 'maths', 'scientific'],
  开源: ['开源', 'open source', 'open-source', 'oss'],
};

/** 疑问/祈使/功能词 + 笔记正文套话：命中它们没有任何检索价值。 */
export const STOPWORDS: string[] = [
  // 功能词
  '的', '了', '是', '我', '你', '他', '她', '它', '我们', '你们', '他们', '这', '那', '这个', '那个',
  '这些', '那些', '一个', '一款', '一些', '什么', '怎么', '怎样', '如何', '为什么', '哪些', '哪个',
  '可以', '能', '能够', '会', '要', '想', '应该', '需要', '请', '求', '帮', '帮我', '给我', '帮忙',
  '找', '找出', '找到', '推荐', '介绍', '告诉', '看看', '类似', '像', '比如', '例如', '以及', '或者',
  '还是', '就是', '也', '都', '很', '更', '最', '比较', '非常', '特别', '支持', '包括', '关于', '有关',
  '用于', '用来', '使用', '用', '做', '学', '有没有', '没有', '有', '是否', '吗', '呢', '吧', '啊',
  '哦', '呀', '的话', '一下', '一点', '多少', '几个', '把', '被', '让', '给', '对', '从', '向', '在',
  '变成', '变', '转为', '生成', '实现', '提供', '具备', '能够用', '怎么用',
  // 泛名词
  '工具', '库', '项目', '平台', '软件', '应用', '系统', '东西', '方案', '功能', '产品', '服务', '内容',
  '资源', '系列', '集合', '清单', '之类', '相关', '方面', '场景', '能力', '任务', '方式', '方法', '过程',
  '框架', '仓库', '技术', '研究', '问题', '答案', '需求', '方向', '结构', '标准', '生态', '社区',
  // 笔记正文套话（来自语料统计：上榜 433、昨日 87、本周 60……）
  '上榜', '昨日', '本周', '今日', '今天', '昨天', '连续', '持续', '增量', '首次', '关联', '对照',
  '回归', '直接', '值得', '中等', '中高', '温和', '无关', '它的', '你的', '你在', '它是', '正是',
  '做完', '如果', '官方', '自述', '说明', '价值', '版本', '模式', '形态', '边界', '领域', '长尾',
  '经典', '老牌', '最新', '样本', '稳定', '产物', '代码库', '仓库地址',
  // 英文功能词
  'a', 'an', 'the', 'and', 'or', 'of', 'for', 'to', 'in', 'on', 'with', 'is', 'are', 'be', 'it',
  'this', 'that', 'how', 'what', 'which', 'can', 'could', 'please', 'find', 'show', 'me', 'my',
  'your', 'our', 'some', 'any', 'i', 'you', 'we', 'want', 'need', 'use', 'using', 'like', 'similar',
];

/** 太常见、保留但降权的词（不是停用词：仍参与匹配，只是权重低）。 */
export const GENERIC_SURFACES: string[] = [
  '数据', '模型', '设计', '系统', '服务', '流程', '平台', '应用', '技术', '研究', '能力', '开发',
  '管理', '处理', '支持', '信息', '内容', '用户', '语言',
];
