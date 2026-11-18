# DSH 适配与验证

适配版本：`dsh-ai-job-countdown@0.1.0`。这是一项技能提供者，不带 UI、模型后端或额外工具。

## 实现

- `package.json` 的 `dsh.bundle.patch` 指向根目录 `cordis.patch.yml`，补丁只插入本包自己的插件行。
- `index.js` 从包自身位置读取原有 `skills/ai-job-countdown/SKILL.md`，无需复制一套 DSH 专用正文。
- 通过 `ctx.skills.registerProvider()` 注册一项 bundled 技能，沿用宿主的 bundled 排序；项目内同名技能可以优先。
- 技能引用的判断方法随包分发，并通过 `resourceBase` 指向其实际目录；不会依赖开发者的工作目录。
- 禁用插件时由 Cordis 生命周期移除提供者；没有持久写入用户技能目录的安装脚本。

## 本地检查

需要 Node.js `>=24.9.0`。使用仓库锁文件安装开发依赖，再运行官方服务集成测试：

```bash
npm ci --ignore-scripts
npm test
npm pack --dry-run
```

测试使用真实的 `@deepseek-ai/cordis@4.1.0` 与 `@deepseek-ai/dsh-skill@0.2.2-rc.1`，检查发现及正文加载、相对资源路径、禁用和重启用、同名项目技能的优先级，以及清单和资源完整性。它们不调用付费模型、不连接企业业务系统。

## 安装

```bash
dsh plugin --profile web add https://github.com/Singapo/ai-job-countdown/releases/download/v0.1.0/dsh-ai-job-countdown-0.1.0.tgz
```

`web` 应替换成实际 Profile。也支持 `dsh plugin --profile web add github:Singapo/ai-job-countdown`。仓库直接分发 JavaScript 和 Markdown，没有源码构建步骤。安装与 Profile 关系以 [DSH 官方发布文档](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.md)为准；Desktop 应使用应用内管理的 Profile。

市场投稿目标为社区目录 [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)。2026-11-18 已提交 [PR #16593](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/16593)，只新增 `data/plugins/Singapo__ai-job-countdown.yml` 一个条目。PR 已提交、CI 通过、维护者合并和市场同步是不同状态；以实际链接和状态为准，不提前宣称已收录。

## 验证边界

2026-11-18 实测环境：Windows x64、Node.js `24.22.3`、官方 DSH CLI `0.2.2-rc.1`，使用专用 `DSH_HOME`，未改用户的现有 Profile。

| 检查 | 结果 |
| --- | --- |
| 官方 Cordis / SkillRegistry 集成测试 | 5/5 通过，含加载、卸载、覆盖优先级、清单与相对链接 |
| 本地预构建 tgz 的 DSH CLI 安装 | 通过，退出码 0；Profile bundles 增加本包 |
| `--dump-config` 配置组合 | 通过，包含本包补丁层与 `ai-job-countdown` 插件行 |
| 额外的 Profile `--help` 启动探针 | 未正常退出，已结束，不计为宿主启动通过 |
| UI、真实模型对话与跨平台完整运行 | 未执行 |

隔离运行时最初省略了可选依赖，启动探针因此暴露缺失 Windows 原生加载器；已仅在测试目录补齐对应组件。上述安装与配置组合结果不等同于完整应用启动验证。

服务集成检查能证明技能可被真实注册表发现、加载和移除，不能证明特定模型会遵循口吻、工作任务已可自动化，或情景时间窗准确。既有[离线演练](../evals/forward-test.md)保留原始版本输出，不改写成新版实测。
