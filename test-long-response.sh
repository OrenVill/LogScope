#!/bin/bash

# Test script to submit a long OpenAI-like response to LogScope

# Make sure the backend is running on localhost:3000
BACKEND_URL="http://localhost:3000"

# Long OpenAI-like response content
LONG_RESPONSE='{
  "id": "chatcmpl-8XvZ9qL7xK2mN9pP3qR5sT7uV9wX1yZ3",
  "object": "chat.completion",
  "created": 1708346123,
  "model": "gpt-4-0125-preview",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "# Complete Guide to Building Scalable Web Applications\n\nBuilding scalable web applications requires careful consideration of multiple architectural layers, from the frontend to the database. This comprehensive guide will walk you through the essential patterns, best practices, and tools you need to know.\n\n## 1. Frontend Architecture\n\n### Component Organization\nWell-structured components are the foundation of maintainable frontend code. Consider implementing a feature-based folder structure where each feature lives in its own directory with all related components, styles, and logic.\n\n### State Management\nChoosing the right state management solution depends on your application complexity. For simple apps, React Context API suffices. For more complex scenarios, Redux, Zustand, or Jotai offer more sophisticated solutions with better DevTools support and debugging capabilities.\n\n### Performance Optimization\n- Code splitting using dynamic imports\n- Tree shaking to eliminate unused code\n- Image optimization and lazy loading\n- Memoization of expensive computations\n- Virtual scrolling for large lists\n\n## 2. Backend Architecture\n\n### API Design\nREST APIs should follow these principles:\n- Use proper HTTP methods (GET, POST, PUT, DELETE)\n- Implement versioning for backward compatibility\n- Return consistent response formats\n- Use appropriate status codes\n- Document endpoints with OpenAPI/Swagger\n\n### Database Optimization\n- Use indexes for frequently queried columns\n- Implement query pagination for large datasets\n- Cache frequently accessed data\n- Use connection pooling\n- Regular backups and monitoring\n\n### Security Considerations\n- Implement authentication (JWT, OAuth)\n- Validate all user inputs\n- Use HTTPS for all communications\n- Rate limiting to prevent abuse\n- CORS configuration\n- SQL injection prevention\n\n## 3. Deployment & Infrastructure\n\n### Containerization\nDocker provides consistency across development and production environments.\n\n### Orchestration\nKubernetes offers robust container orchestration for large-scale applications.\n\n### Monitoring & Logging\nComprehensive logging helps identify issues:\n- Structured logging with fields like timestamp, level, service\n- Centralized log aggregation\n- Real-time alerts for critical errors\n- Performance metrics and tracing\n\n## 4. Testing Strategy\n\n### Unit Testing\n- Test business logic in isolation\n- Aim for >80% code coverage\n- Use fast, reliable test runners\n\n### Integration Testing\n- Test interactions between components\n- Test API endpoints\n- Test database operations\n\n### E2E Testing\n- Test complete user workflows\n- Use tools like Cypress or Playwright\n- Test in multiple browsers\n\n## 5. CI/CD Pipeline\n\nAutomate your deployment process:\n1. Code commit triggers tests\n2. Static analysis checks\n3. Build stages\n4. Automated deployment to staging\n5. Manual approval for production\n6. Automated deployment to production\n\n## Conclusion\n\nScalable web applications require planning across multiple dimensions. Focus on clean architecture, proper testing, and automated deployments. Start simple and add complexity only when needed. Monitor your application in production and continuously improve based on real-world usage patterns.\n\nRemember: premature optimization is the root of all evil. Profile first, optimize second."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 156,
    "completion_tokens": 1247,
    "total_tokens": 1403
  },
  "system_fingerprint": "fp_8b73c3c6d1"
}'

echo "Submitting long OpenAI response to LogScope..."
echo ""

curl -X POST "$BACKEND_URL/api/logs/collect" \
  -H "Content-Type: application/json" \
  -d "{
    \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
    \"level\": \"info\",
    \"subject\": \"openai-api-response\",
    \"content\": $LONG_RESPONSE,
    \"source\": {
      \"function\": \"handleAIResponse\",
      \"file\": \"aiService.ts\",
      \"process\": \"worker-1\",
      \"runtime\": \"node\",
      \"serviceName\": \"ai-integration\"
    },
    \"correlation\": {
      \"requestId\": \"req_$(date +%s)\",
      \"sessionId\": \"sess_abc123xyz\",
      \"userId\": \"user_456\"
    }
  }"

echo ""
echo "✓ Long OpenAI response submitted!"
echo ""
echo "Visit http://localhost:5173 and click the ▶ arrow on the latest log to expand it."
echo "You should see the full OpenAI response with proper formatting and scrolling."
