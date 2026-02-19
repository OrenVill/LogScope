@echo off
REM Test script to submit a long OpenAI-like response to LogScope

setlocal enabledelayedexpansion

REM Make sure the backend is running on localhost:3000
set "BACKEND_URL=http://localhost:3000"

REM Get current timestamp in ISO format
for /f "tokens=2-4 delims=/ " %%a in ('date /t') do (set mydate=%%c-%%a-%%b)
for /f "tokens=1-2 delims=/:" %%a in ('time /t') do (set mytime=%%a:%%b)
set "TIMESTAMP=!mydate!T!mytime!:00Z"

echo Submitting long OpenAI response to LogScope...
echo.

REM Create a temporary JSON file with the long response
(
  echo {
  echo   "timestamp": "!TIMESTAMP!",
  echo   "level": "info",
  echo   "subject": "openai-api-response",
  echo   "content": "{\r\n  \"id\": \"chatcmpl-8XvZ9qL7xK2mN9pP3qR5sT7uV9wX1yZ3\",\r\n  \"object\": \"chat.completion\",\r\n  \"created\": 1708346123,\r\n  \"model\": \"gpt-4-0125-preview\",\r\n  \"choices\": [\r\n    {\r\n      \"index\": 0,\r\n      \"message\": {\r\n        \"role\": \"assistant\",\r\n        \"content\": \"# Complete Guide to Building Scalable Web Applications\n\nBuilding scalable web applications requires careful consideration of multiple architectural layers, from the frontend to the database. This comprehensive guide will walk you through the essential patterns, best practices, and tools you need to know.\n\n## 1. Frontend Architecture\n\n### Component Organization\nWell-structured components are the foundation of maintainable frontend code. Consider implementing a feature-based folder structure where each feature lives in its own directory with all related components, styles, and logic.\n\n### State Management\nChoosing the right state management solution depends on your application complexity. For simple apps, React Context API suffices. For more complex scenarios, Redux, Zustand, or Jotai offer more sophisticated solutions with better DevTools support and debugging capabilities.\n\n### Performance Optimization\n- Code splitting using dynamic imports\n- Tree shaking to eliminate unused code\n- Image optimization and lazy loading\n- Memoization of expensive computations\n- Virtual scrolling for large lists\n\n## 2. Backend Architecture\n\n### API Design\nREST APIs should follow these principles:\n- Use proper HTTP methods (GET, POST, PUT, DELETE)\n- Implement versioning for backward compatibility\n- Return consistent response formats\n- Use appropriate status codes\n- Document endpoints with OpenAPI/Swagger\n\n### Database Optimization\n- Use indexes for frequently queried columns\n- Implement query pagination for large datasets\n- Cache frequently accessed data\n- Use connection pooling\n- Regular backups and monitoring\n\n### Security Considerations\n- Implement authentication (JWT, OAuth)\n- Validate all user inputs\n- Use HTTPS for all communications\n- Rate limiting to prevent abuse\n- CORS configuration\n- SQL injection prevention\n\n## 3. Deployment & Infrastructure\n\n### Containerization\nDocker provides consistency across development and production environments.\n\n### Orchestration\nKubernetes offers robust container orchestration for large-scale applications.\n\n### Monitoring & Logging\nComprehensive logging helps identify issues:\n- Structured logging with fields like timestamp, level, service\n- Centralized log aggregation\n- Real-time alerts for critical errors\n- Performance metrics and tracing\n\n## 4. Testing Strategy\n\n### Unit Testing\n- Test business logic in isolation\n- Aim for >80% code coverage\n- Use fast, reliable test runners\n\n### Integration Testing\n- Test interactions between components\n- Test API endpoints\n- Test database operations\n\n### E2E Testing\n- Test complete user workflows\n- Use tools like Cypress or Playwright\n- Test in multiple browsers\n\n## 5. CI/CD Pipeline\n\nAutomate your deployment process:\n1. Code commit triggers tests\n2. Static analysis checks\n3. Build stages\n4. Automated deployment to staging\n5. Manual approval for production\n6. Automated deployment to production\n\n## Conclusion\n\nScalable web applications require planning across multiple dimensions. Focus on clean architecture, proper testing, and automated deployments. Start simple and add complexity only when needed. Monitor your application in production and continuously improve based on real-world usage patterns.\n\nRemember: premature optimization is the root of all evil. Profile first, optimize second.\"\n      },\n      \"finish_reason\": \"stop\"\n    }\n  ],\n  \"usage\": {\n    \"prompt_tokens\": 156,\n    \"completion_tokens\": 1247,\n    \"total_tokens\": 1403\n  },\n  \"system_fingerprint\": \"fp_8b73c3c6d1\"\n}",
  echo   "source": {
  echo     "function": "handleAIResponse",
  echo     "file": "aiService.ts",
  echo     "process": "worker-1",
  echo     "runtime": "node",
  echo     "serviceName": "ai-integration"
  echo   },
  echo   "correlation": {
  echo     "requestId": "req_!random!",
  echo     "sessionId": "sess_abc123xyz",
  echo     "userId": "user_456"
  echo   }
  echo }
) > test_payload.json

curl -X POST "!BACKEND_URL!/api/logs/collect" ^
  -H "Content-Type: application/json" ^
  -d @test_payload.json

del test_payload.json

echo.
echo X Long OpenAI response submitted!
echo.
echo Visit http://localhost:5173 and click the arrow on the latest log to expand it.
echo You should see the full OpenAI response with proper formatting and scrolling.
echo.
pause
