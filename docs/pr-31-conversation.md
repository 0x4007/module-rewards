# Pull Request #31: Model Prompt rewrite

**Status:** Closed (Not Merged)
**Author:** @shiv810
**Created:** Nov 2, 2024
**Closed:** Jan 16, 2025

## Description

Resolves #30

- The reasoning is reorganized with a more modular approach to context.
- The model receives a list of tools that it utilizes to gather additional context and information.
- Context is integrated based on the tool calls performed by the LLM.
- The LLM employs a multi-step Chain of Thought prompt, focusing on reasoning between each step.

## Changes Overview
- Files changed: 10
- Additions: 1,003
- Deletions: 161

## Timeline

### Initial PR Description and QA
**@shiv810** provided initial QA links:
- [Issue with Data from Discussions](https://github.com/sshivaditya2019/test-public/issues/209#issuecomment-2452802275)
- [Issue with PR Summary](https://github.com/sshivaditya2019/test-public/issues/209#issuecomment-2452815731)
- [Issue with Out of Context Question](https://github.com/sshivaditya2019/test-public/issues/199#issuecomment-2452833490)
- [Issue not being discussed in context](https://github.com/sshivaditya2019/test-public/issues/199#issuecomment-2452800668)
- [Question from Context](https://github.com/sshivaditya2019/test-public/issues/199#issuecomment-2452790193)

### Initial Architecture Concerns
**@Keyrxng** commented:
> I don't think this is the right thing to do. [...] Rewriting the model prompt doesn't involve taking all of our functions and turning them into LLM tools and have the AI be involved in the collection of the data via parsing comments or fetching diffs or anything like that...
>
> We should programmatically obtain all the data, the LLM should not play a part in that at all. It having these tools, in my mind, is a poor decision.
>
> If the intention is to improve the context the AI has by allowing it to custom search context against the GitHub API then clearly embeddings search is the problem as it should have _everything_ that we have on GitHub.

## Code Review Comments

### src/adapters/openai/helpers/format-output.ts

**@0x4007** commented on line 102:
> I think this is only viable with temperature 0 etc. couldn't this also cause a problem with quotes? If the text is quoted from elsewhere and it contains one of these expressions it might cause problems.

**@shiv810** replied:
> This only removes, the phrases from the generated output, and not quoted text. I don't think this is necessary, basically ensures the tone of the response.

**@Keyrxng** later added:
> doesn't this remove uncertainty and caution from the statements that would follow these phrases? Isn't an LLM likely to interpret these strings as indicating subjectivity, I'd think that these would give key context that we are not 100% on the following fact.
>
> https://chatgpt.com/share/672642c9-0e90-8000-871c-613f8a2768b2
>
> I see it used at the end of `createCompletion` which would imply it's stripping these from final output that we receive as well as completions sent between llm calls, is that right?

**@shiv810** responded:
> While it does remove the contextual cues you mentioned, the second model, like o1-mini, offers better reasoning capabilities that can address ambiguous cases. It manages all the formatting and processing, which is beneficial. Although this isn't a perfect solution, it ensures a consistent tone across different outputs without unnecessary preambles before each message.

### src/handlers/ask-llm.ts

**@0x4007** commented on line 50:
> What is this

**@shiv810** replied:
> This was hardcoded into the tests, for askQuestion. I'll remove this

**@Keyrxng** added:
> this is added via the logger you don't need `caller`

## Extended Discussion

### Architecture and Implementation Debate

**@shiv810** responded to initial concerns:
> The model is effectively performing the same actions: calling Similar Comments, then Similar Issues, and finally Issue Search. Previously, these tasks would have been executed simultaneously, but now the model processes the data sequentially. [...] Apart from that, this can achieve performance close to o1-mini using just GPT-4o. I believe that would provide significant cost savings.

**@Keyrxng** raised detailed concerns:
> The model's process hasn't changed [...] But why does it need to do this?
>
> From your description, search should pull in the most relevant context beyond linked issues (with an unlimited fetch depth, a key goal for 0x4007). Now we lack control over linked issue collection, embedding search, etc.
>
> Previously, `createCompletion` was the final step, pulling context from recursively fetched linked issues and embedding search results. We then passed this to a `reranker` before feeding it to the LLM. Is the embedding search underperforming in relevance assignment?

**@shiv810** addressed the concerns about control and implementation:
> We have control over what is passed and what is called. The recursive search is still in place; the main difference is in the execution order. Instead of processing everything at once, the LLM now handles it more sequentially.
>
> As I mentioned earlier, we're aiming to integrate everything retrieved so far into the model's context window. This ensures the process occurs over multiple calls, allowing the model to prioritize what's essential in each iteration.

### Final Positions

**@Keyrxng** summarized their position:
> tldr; I'm not against giving the LLM full control but first we should effectively benchmarks our core components and then take it from there. An autonomous chatbot would be pretty cool fetching whatever it wants to but we need better foundations first.

**@0x4007** concluded:
> @Keyrxng you should let shiv focus on shipping this stuff and we'll address potential future problems iteratively.

## Summary

The PR sparked significant discussion about architectural choices and implementation approaches:

1. Core debate around LLM tool autonomy vs programmatic control
2. Questions about data collection and processing approach
3. Concerns about embedding search performance and benchmarking
4. Discussion of sequential vs parallel processing
5. Need for better benchmarking and evaluation metrics

The PR was ultimately closed without being merged on January 16, 2025, with a decision to address potential issues iteratively rather than blocking progress.
