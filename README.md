# Incalmo：用于多主机网络红队测试的自主大语言模型辅助系统

> **本地版本说明：安装源已改为中国科学技术大学（中科大／USTC）镜像。**
>
> - 三个 Docker 镜像中的 Kali Linux 和 Ubuntu apt 软件源使用中科大镜像，并增加了下载重试和超时设置。
> - pip 安装 `uv`，以及项目的 `uv sync`、`uv run` 所用 Python 包索引，使用 `https://mirrors.ustc.edu.cn/pypi/simple`。
> - Go 模块使用 `https://goproxy.cn,direct`，这不是中科大镜像；模块不可用时可回退到直接下载。
> - Docker 基础镜像、Go 编译器压缩包和 Metasploit 安装脚本仍从原始来源下载。
>
> 当前本地实验配置使用 DeepSeek Flash（API 模型名为 `deepseek-flash`）。英文原文保存在 [README.en.md](README.en.md)。

<div align="center">

[![MIT 许可证](https://img.shields.io/badge/License-MIT-green.svg)](https://choosealicense.com/licenses/mit/)
![GitHub 问题](https://img.shields.io/github/issues/bsinger98/Incalmo?style=flat-square)
![GitHub 拉取请求](https://img.shields.io/github/issues-pr/bsinger98/Incalmo?style=flat-square)
![GitHub 提交活动](https://img.shields.io/github/commit-activity/m/bsinger98/Incalmo?style=flat-square)
![GitHub 贡献者](https://img.shields.io/github/contributors/bsinger98/Incalmo?style=flat-square)
![GitHub 星标](https://img.shields.io/github/stars/bsinger98/Incalmo?style=flat-square)
![GitHub 分支](https://img.shields.io/github/forks/bsinger98/Incalmo?style=flat-square)

Incalmo 是一款自主 AI 驱动的网络渗透测试工具，能够自动开展智能红队测试，旨在增强和辅助操作人员执行复杂网络攻击任务的能力。

**研究论文：**[使用大语言模型执行多阶段网络攻击的可行性研究（On the Feasibility of Using LLMs to Execute Multistage Network Attacks）](https://arxiv.org/abs/2501.16466)

**官方网站：**访问 [Incalmo 网站](https://www.incalmo.ai/) 了解更多信息。

</div>

---

## 目录

- [运行前提](#运行前提)
- [安装](#安装)
- [使用方法](#使用方法)
- [技术栈](#技术栈)
- [项目结构](#项目结构)
- [参与贡献](#参与贡献)
- [许可证](#许可证)
- [引用说明](#引用说明)
- [支持](#支持)

## 运行前提

- **[Docker](https://www.docker.com/) 和 Docker Compose**：用于容器化环境。可使用 Docker Desktop；本地 Kali 环境也可使用 Docker Engine 和 Compose。
- **[Python 3.13+](https://www.python.org/downloads/)**：本地开发时需要；使用 Docker 时由镜像提供。
- **[uv](https://github.com/astral-sh/uv)**：推荐使用的快速 Python 包和项目管理工具。原文也列出了 pip，但下文运行命令使用 uv。
- **大语言模型 API 密钥**：至少准备以下一种，并与所选模型对应：
  - [OpenAI API 密钥](https://platform.openai.com/api-keys)：用于 GPT 模型。
  - [Anthropic API 密钥](https://console.anthropic.com/)：用于 Claude 模型。
  - [Google API 密钥](https://makersuite.google.com/app/apikey)：用于 Gemini 模型。
  - [DeepSeek API 密钥](https://platform.deepseek.com/)：用于 DeepSeek 模型。
- **[Node.js](https://nodejs.org/en)**（可选）：仅在使用 [Web 界面](#web-界面可选) 时需要。

## 安装

### 1. 准备配置文件

以下命令从项目根目录执行。首次配置时，复制示例文件：

```bash
cp -n config/config_example.json config/config.json
```

然后按需编辑 `config/config.json`。`-n` 用于保留已经存在的本地配置。

当前本地版本已配置 DeepSeek Flash，策略部分如下：

```json
"strategy": {
    "planning_llm": "deepseek-flash",
    "execution_llm": "deepseek-flash",
    "abstraction": "incalmo"
}
```

本地 Docker 实验还使用以下控制服务器地址：

```json
"c2c_server": "http://127.0.0.1:8888",
"agent_c2c_server": "http://192.168.200.10:8888"
```

前者供容器内的策略访问控制服务器，后者供实验网络中的目标侧代理访问控制服务器。这些设置属于本地配置，复制上游示例文件不会自动获得这些值。

### 2. 设置 API 密钥

复制环境变量示例文件：

```bash
cp -n .env.example .env
```

在 `.env` 中填写所用模型的 API 密钥，例如：

```dotenv
DEEPSEEK_API_KEY='在此填写你的密钥'
```

`.env` 已从 Docker 构建上下文中排除，运行时由 Compose 加载。

### 3. 启动开发环境

进入 `docker` 目录，首次构建并在后台启动容器：

```bash
cd docker
docker compose up --build -d
```

如果当前账户无权访问 Docker，请在 Docker 命令前加 `sudo`。

镜像构建完成后，通常只需执行以下命令即可再次启动：

```bash
docker compose up -d
```

检查服务状态和启动日志：

```bash
docker compose ps
docker compose logs --tail=100 attacker
curl http://localhost:8888/health
```

> **MHBench 集成（与本地 Docker 实验不同）**
>
> 根据上游说明，接入 MHBench 时，应先将 `docker/docker-compose.attacker.yml` 和 `docker/docker-compose.yml` 中的 `MODE` 环境变量设为 `remote`。
>
> 在执行下一步之前，先编译并配置实验所需的 MHBench 环境，并确保 `config.json` 的控制服务器地址为：
>
> ```json
> "c2c_server": "http://localhost:8888"
> ```
>
> 当前本地自带实验使用 `MODE=docker`；只有接入 MHBench 时才需要按该环境的要求调整。

### 4. 运行 Incalmo

在另一个终端窗口中，进入项目的 `docker` 目录，在已启动的攻击端容器内执行策略：

```bash
docker compose exec attacker uv run main.py
```

也可以先进入容器，再运行：

```bash
docker compose exec attacker /bin/bash
uv run main.py
```

`main.py` 读取配置、初始化策略，并启动模型决策循环；控制服务器由容器启动脚本提前启动。运行日志保存到项目的 `output/` 目录。

按 **Ctrl+C** 可中断前台策略进程。停止并移除实验容器和网络：

```bash
docker compose down
```

该命令不会删除构建好的镜像、命名卷或本地 `output/` 日志。

### Web 界面（可选）

如果希望通过浏览器使用 Incalmo，可启动 Web 界面。

#### 1. 启动后端

先完成上述安装步骤 1 至 3。

#### 2. 安装 Node.js 依赖

从项目根目录进入前端目录并安装依赖：

```bash
cd incalmo/frontend/incalmo-ui
npm install
```

#### 3. 启动 React 开发服务器

```bash
npm start
```

随后可访问 [http://localhost:3000](http://localhost:3000)。

## 使用方法

“策略”（strategy）是驱动测试过程的逻辑。可在 [strategies/](incalmo/core/strategies) 目录中查看基于大语言模型和状态机的策略示例。

### 使用大语言模型策略

1. 完成[安装](#安装)。
2. 在 `config/config.json` 中指定要使用的模型。可用部署名称见[模型注册表](incalmo/core/strategies/llm/langchain_registry.py)；配置结构可参考 `config/config_example.json`。
3. 按安装步骤运行 `main.py`。
4. 在 `output/` 目录中查看执行状态、模型交互和动作记录。每次运行的日志目录名称包含时间戳。

上游文档推荐通过命令行运行并查看日志，作为较稳定的测试方式。

### 使用非大语言模型的状态机策略

Incalmo 也支持自定义状态机策略：

1. 完成[安装](#安装)。
2. 参考 `config/config_example_state_machine.json`，在 `config/config.json` 中填写手动策略的类名。已有实现见 [strategies/state_machine/](incalmo/core/strategies/state_machine)。
3. 运行 `main.py`。
4. 在 `output/` 对应时间戳的目录中查看日志。

创建基础策略时，可在 `strategies/state_machine/` 中新增文件：

```python
class YourStrategyName(IncalmoStrategy):
    async def step(self) -> bool:
        # 在这里实现策略逻辑
        pass
```

建议结合已有策略了解代码结构及可用能力。

### 使用 Web 界面

启动前端后，可在界面中启动、停止策略并实时查看日志。通过界面启动运行时，无需同时手动执行 `main.py`。

## 技术栈

- **后端：**Python 3.13、Flask、Celery、SQLite。
- **大语言模型集成：**LangChain、OpenAI、Anthropic、Google Gemini、DeepSeek。
- **前端：**React、TypeScript、Node.js。
- **容器化：**Docker、Docker Compose。
- **包管理：**uv。

## 项目结构

```text
Incalmo/
├── .env.example               # 环境变量配置模板
├── CITATION.cff               # 研究论文引用元数据
├── LICENSE                    # MIT 许可证
├── main.py                    # 命令行入口：运行 Incalmo 策略
├── README.md                  # 中文项目指南及本地配置说明
├── README.en.md               # 保留的英文原文
├── config/                    # 配置管理
├── docker/                    # Docker 容器配置
│   ├── attacker/              # 攻击端容器配置
│   └── equifax/               # 目标环境：Equifax 数据泄露事件模拟
│       ├── database/          # 数据库服务器容器
│       └── webserver/         # Web 服务器容器
├── incalmo/                   # 核心应用代码
│   ├── incalmo_runner.py      # 策略执行循环
│   ├── server.py              # 服务启动入口
│   ├── api/                   # 与控制服务器通信的客户端 API
│   ├── c2server/              # 命令与控制服务器（C2）
│   │   ├── agents/            # 代理程序实现
│   │   ├── celery/            # 异步任务队列
│   │   ├── payloads/          # 漏洞利用与部署载荷
│   │   └── routes/            # API 端点的 Flask 蓝图
│   ├── core/                  # 核心测试框架
│   │   ├── actions/           # 动作类
│   │   │   ├── EmptyServiceActions/   # 占位动作
│   │   │   ├── HighLevel/             # 高层动作
│   │   │   │   └── llm_agents/        # 大语言模型代理动作实现
│   │   │   └── LowLevel/              # 底层命令
│   │   │       └── privledge_escalation/  # 权限提升实现
│   │   ├── models/            # 核心领域模型
│   │   │   ├── events/        # 状态更新事件系统
│   │   │   └── network/       # 网络基础设施模型
│   │   ├── services/          # 核心逻辑服务
│   │   └── strategies/        # 测试策略
│   │       ├── llm/           # 基于大语言模型的策略
│   │       ├── state_machine/ # 基于规则的策略
│   │       ├── testers/       # 策略测试工具
│   │       └── util/          # 策略辅助工具
│   ├── frontend/              # Web 界面
│   │   └── incalmo-ui/        # React 前端
│   └── models/                # 共享数据模型（Pydantic）
└── output/                    # 执行日志和结果
```

## 参与贡献

欢迎贡献！如果你对改进项目有想法，可以提交 Issue 或 Pull Request。

## 许可证

本项目采用 [MIT 许可证](LICENSE)。

## 引用说明

引用本项目或论文时，请参考 [CITATION.cff](CITATION.cff) 中的规范。

## 支持

如需支持，请发送邮件至 hello@incalmo.ai。
