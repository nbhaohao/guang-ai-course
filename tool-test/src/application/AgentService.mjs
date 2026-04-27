import { ToolMessage } from '@langchain/core/messages';

// 应用层 — Agent 服务
// 编排领域对象（ChatSession）和基础设施（model、tools），不含业务规则
export class AgentService {
    constructor({ model, tools, session }) {
        this.modelWithTools = model.bindTools(tools);
        this.tools = tools;
        this.session = session;
    }

    async run() {
        let response = await this.modelWithTools.invoke(this.session.getMessages());
        this.session.addMessage(response);

        while (response.tool_calls?.length > 0) {
            console.log(`\n[检测到 ${response.tool_calls.length} 个工具调用]`);

            // 并行执行所有工具调用（原代码 bug: awaitPromise.all → await Promise.all）
            const toolResults = await Promise.all(
                response.tool_calls.map(async (toolCall) => {
                    const matchedTool = this.tools.find(t => t.name === toolCall.name);
                    if (!matchedTool) return `错误: 找不到工具 ${toolCall.name}`;

                    console.log(`  [执行工具] ${toolCall.name}(${JSON.stringify(toolCall.args)})`);
                    try {
                        return await matchedTool.invoke(toolCall.args);
                    } catch (error) {
                        return `错误: ${error.message}`;
                    }
                })
            );

            // 将工具结果写回会话
            response.tool_calls.forEach((toolCall, index) => {
                this.session.addMessage(
                    new ToolMessage({
                        content: toolResults[index],
                        tool_call_id: toolCall.id,
                    })
                );
            });

            response = await this.modelWithTools.invoke(this.session.getMessages());
            this.session.addMessage(response);
        }

        return response.content;
    }
}
