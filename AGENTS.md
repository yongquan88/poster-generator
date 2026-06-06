# AGENTS.md

面向在本仓库内工作的 AI 编程代理。请先阅读本文件，再修改代码或文档。

## 项目概览

这是一个基于 Vite、React 19、TypeScript、Zustand 和 Tailwind CSS 的图片生成与编辑 Web 应用。核心能力包括文本生图、参考图编辑、遮罩编辑、历史记录、本地 IndexedDB 存储、多 API 配置和多服务商接入。

项目是纯前端应用，构建产物部署为静态资源；本地开发和 Docker 部署可通过代理解决浏览器 CORS 问题。

## 常用命令

- 安装依赖：`npm install` 或 CI 场景使用 `npm ci`
- 本地开发：`npm run dev`
- 本地模拟图片 API：`npm run mock:api`
- 构建：`npm run build`
- 运行测试：`npm test`
- 监听测试：`npm run test:watch`
- 预览构建产物：`npm run preview`

提交前优先运行与改动相关的测试；涉及共享逻辑、API 调用、参数兼容、遮罩、尺寸或存储行为时，至少运行 `npm test`。涉及打包、环境变量、部署或 Vite 配置时运行 `npm run build`。

## 目录与职责

- `src/App.tsx`：应用入口布局，挂载主界面、底部输入栏、弹窗、Toast、遮罩编辑器等。
- `src/store.ts`：Zustand 全局状态、任务提交、历史记录、图片缓存、IndexedDB 读写编排。
- `src/types.ts`：应用核心类型、任务参数、设置、任务记录、图片存储结构。
- `src/components/`：React UI 组件。新增 UI 时优先复用现有组件和 Tailwind 风格。
- `src/hooks/`：通用 React hooks。
- `src/lib/`：API 调用、服务商适配、参数兼容、尺寸、遮罩、IndexedDB、URL 设置等纯逻辑。
- `src/lib/*.test.ts`：Vitest 单元测试，与同名逻辑文件放在同目录。
- `vite.config.ts`：Vite 配置和本地 OpenAI SDK 代理插件。
- `scripts/mock-image-api.mjs`：本地故障模拟 API。
- `deploy/`：Docker/Nginx 运行时环境变量注入与代理配置。
- `docs/`：项目说明、模拟 API 文档和示例图片。

## 服务商与中转站接入

项目支持内置服务商、OpenAI 兼容接口和自定义 HTTP 服务商。修改相关逻辑时要确认 `src/lib/apiProfiles.ts`、`src/lib/openaiCompatibleImageApi.ts`、`vite.config.ts` 和对应测试是否需要同步更新。

当前代码中特别需要注意的服务商/中转站：

- OpenAI 兼容接口：默认 provider 为 `openai`，支持 `Images API` 和 `Responses API`，默认模型为 `gpt-image-2`。默认 Base URL 来自 `VITE_DEFAULT_API_URL`，未配置时为 `https://api.qiuqiutoken.com/v1`。
- fal.ai：内置 provider 为 `fal`，默认 Base URL 为 `https://fal.run`，默认模型为 `openai/gpt-image-2`，走 `src/lib/falAiImageApi.ts`。
- qiuqiuToken：`src/lib/qiuqiuToken.ts` 中定义 `https://img.qiuqiutoken.com/v1` 和模型 `gpt-image-2`。识别规则覆盖 `qiuqiutoken.com` 及其子域名，包括默认的 `https://api.qiuqiutoken.com/v1`。请求会带 `qmp_options` 异步参数，任务轮询走 `images/tasks/{task_id}`；本地开发 SDK 代理会加 `x-qiuqiu-token-async: true`。
- hfsyapi：`src/lib/hfsyapi.ts` 中定义 `https://www.hfsyapi.cn/v1`，固定模型为 `gpt-image-2pro`，最多支持 4 张参考图，当前流程不支持遮罩。相关 UI 和 API 限制要保持一致。
- aitechflux.com：当前作为标准 OpenAI 兼容中转站场景覆盖在测试中，典型 Base URL 为 `https://aitechflux.com/v1`。代码没有单独的 `aitechflux` 适配模块；除非确认其返回结构或参数要求特殊，否则应继续走通用 OpenAI 兼容流程。
- 自定义 HTTP 服务商：用户可导入 JSON manifest，逻辑在 `normalizeCustomProviderDefinition`、`callCustomHttpImageApi` 等路径。新增字段时要兼顾旧版 `openai-compatible` / `openai-compatible-async` 配置迁移。

不要在代码、测试、文档或提交信息中写入真实 API Key。测试中使用假 key。

## 开发约定

- 使用 TypeScript 严格模式。新增共享类型放在 `src/types.ts` 或靠近使用方的 `src/lib/*` 文件中。
- API 相关改动优先保持服务商边界清晰：入口在 `callImageApi`，OpenAI 兼容分支在 `openaiCompatibleImageApi.ts`，fal.ai 分支在 `falAiImageApi.ts`，配置归一化在 `apiProfiles.ts`。
- 与图片尺寸、参数兼容、遮罩、参考图数量、模型限制相关的行为必须同步考虑 UI、请求构造、错误提示和测试。
- IndexedDB 是历史记录和图片的主要存储位置；不要引入服务端持久化假设。
- 图片内容可能是大体积 data URL。处理缓存、缩略图、ZIP 导入导出时注意内存和并发控制。
- 本地代理只应服务开发或容器部署场景。修改 `/api-proxy/`、`/openai-sdk-proxy/` 或 Docker 注入逻辑时，要检查 CORS、鉴权头、Base URL 透传和错误提示。
- URL 查询参数可快速填充设置，相关逻辑在 `src/lib/urlSettings.ts`，修改配置字段时要考虑兼容。

## UI 与样式约定

- 主要使用 Tailwind class，少量全局样式放在 `src/index.css`。
- UI 已考虑深色模式、移动端、安全区、拖拽、侧滑、多选和弹窗动画。新增组件要保持这些交互习惯。
- 优先复用 `Select`、`Checkbox`、`ConfirmDialog`、`Toast`、`ViewportTooltip` 等现有组件。
- 文案以中文为主，错误提示要说明用户可执行的下一步。
- 不要破坏图片保存、右键菜单、Lightbox、遮罩编辑器和移动端输入体验。

## 测试要求

- `src/lib` 中的纯逻辑改动应补或更新同目录 Vitest 测试。
- API 请求构造、响应解析、服务商识别、轮询、代理和错误提示改动应更新 `src/lib/api.test.ts` 或对应服务商测试。
- 参数兼容、尺寸规范、遮罩预处理、URL 设置、提示词片段和 prompt 图片引用改动应运行对应测试文件。
- UI 行为如果难以单测，至少说明手动验证范围，并在能抽成纯逻辑时补单测。

## 部署与环境

- 静态构建输出在 `dist/`。
- GitHub Pages 和 Docker 工作流使用 Node 20。
- Vercel、Cloudflare Workers、Docker 和普通静态服务器均可部署。
- 前端构建期默认 API URL 使用 `VITE_DEFAULT_API_URL`。
- Docker 运行时可通过 `DEFAULT_API_URL`、`API_PROXY_URL`、`ENABLE_API_PROXY`、`LOCK_API_PROXY`、`HOST`、`PORT` 注入配置。
- 修改部署脚本时同步检查 `README.md`、`deploy/`、`vercel.json`、`wrangler.jsonc` 和 GitHub Actions。

## 变更流程

1. 先用 `rg` 搜索相关代码、测试和文档。
2. 小步修改，避免无关重构。
3. 同步更新测试和用户可见文档。
4. 运行相关测试；高风险改动运行 `npm test` 和 `npm run build`。
5. 最终说明改动内容、验证命令和未覆盖风险。

