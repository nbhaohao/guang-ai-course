import { z } from 'zod';
import { OpenAIChatService } from './shared.mjs';

const scientistSchema = z.object({
  name: z.string().describe('科学家的全名'),
  birth_year: z.number().describe('出生年份'),
  death_year: z.number().optional().describe('去世年份，如果还在世则不填'),
  nationality: z.string().describe('国籍'),
  fields: z.array(z.string()).describe('研究领域列表'),
  achievements: z.array(z.string()).describe('主要成就'),
  biography: z.string().describe('简短传记'),
});

const toolDef = {
  name: 'extract_scientist_info',
  description: '提取和结构化科学家的详细信息',
  schema: scientistSchema,
};

async function main() {
  const llm = new OpenAIChatService();

  console.log('📡 实时输出流式内容:\n');

  let chunkCount = 0;
  for await (const toolCall of llm.streamToolCall('详细介绍牛顿的生平和成就', toolDef)) {
    chunkCount++;
    console.log(`--- chunk #${chunkCount} ---`);
    console.log(toolCall.args);
  }

  console.log(`\n✅ 流式输出完成，共 ${chunkCount} 个 chunk`);
}

main().catch((err) => {
  console.error('\n❌ 错误:', err.message);
  console.error(err);
});
