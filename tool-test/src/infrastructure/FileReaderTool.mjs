import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import fs from 'fs/promises';

// 基础设施层 — 文件读取工具（外部能力适配器）
export function createFileReaderTool() {
    return tool(
        async ({ filePath }) => {
            const content = await fs.readFile(filePath, 'utf-8');
            console.log(`  [工具调用] read_file("${filePath}") - 成功读取 ${content.length} 字节`);
            return `文件内容:\n${content}`;
        },
        {
            name: 'read_file',
            description: '读取文件内容。当用户要求读取文件、查看代码、分析文件内容时调用。输入文件路径（相对或绝对路径均可）。',
            schema: z.object({
                filePath: z.string().describe('要读取的文件路径'),
            }),
        }
    );
}
