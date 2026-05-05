import { z } from 'zod';
import { OpenAIChatService, ZodStructuredOutputParserAdapter } from './shared.mjs';

const schema = z.object({
  name: z.string().describe('姓名'),
  birth_year: z.number().describe('出生年份'),
  death_year: z.number().describe('去世年份'),
  nationality: z.string().describe('国籍'),
  occupation: z.string().describe('职业'),
  famous_works: z.array(z.string()).describe('著名作品列表'),
  biography: z.string().describe('简短传记'),
});

async function main() {
  const llm = new OpenAIChatService();
  const parser = new ZodStructuredOutputParserAdapter(schema);

  const prompt = `详细介绍莫扎特的信息。\n\n${parser.getFormatInstructions()}`;

  console.log('🌊 流式结构化输出演示\n');
  console.log('📡 接收流式数据:\n');

  let fullContent = '';
  let chunkCount = 0;

  for await (const chunk of llm.stream(prompt)) {
    chunkCount++;
    fullContent += chunk;
    process.stdout.write(chunk);
  }

  console.log(`\n\n✅ 共接收 ${chunkCount} 个数据块\n`);

  const result = await parser.parse(fullContent);

  console.log('📊 解析后的结构化结果:\n');
  console.log(JSON.stringify(result, null, 2));

  console.log('\n📝 格式化输出:');
  console.log(`姓名: ${result.name}`);
  console.log(`出生年份: ${result.birth_year}`);
  console.log(`去世年份: ${result.death_year}`);
  console.log(`国籍: ${result.nationality}`);
  console.log(`职业: ${result.occupation}`);
  console.log(`著名作品: ${result.famous_works.join(', ')}`);
  console.log(`传记: ${result.biography}`);
}

main().catch((err) => console.error('\n❌ 错误:', err.message));
