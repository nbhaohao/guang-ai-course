import { OpenAIChatService, StructuredOutputParserAdapter } from './shared.mjs';

async function main() {
  const llm = new OpenAIChatService();
  const parser = new StructuredOutputParserAdapter({
    name: '姓名',
    birth_year: '出生年份',
    nationality: '国籍',
    major_achievements: '主要成就，用逗号分隔的字符串',
    famous_theory: '著名理论',
  });

  const question = `请介绍一下爱因斯坦的信息。

${parser.getFormatInstructions()}`;

  console.log('question:', question);
  console.log('🤔 正在调用大模型（使用 StructuredOutputParser）...\n');

  const raw = await llm.invoke(question);
  console.log('📤 模型原始响应:\n');
  console.log(raw);

  const result = await parser.parse(raw);
  console.log('\n✅ StructuredOutputParser 自动解析的结果:\n');
  console.log(result);
  console.log(`姓名: ${result.name}`);
  console.log(`出生年份: ${result.birth_year}`);
  console.log(`国籍: ${result.nationality}`);
  console.log(`著名理论: ${result.famous_theory}`);
  console.log(`主要成就: ${result.major_achievements}`);
}

main().catch((err) => console.error('❌ 错误:', err.message));
