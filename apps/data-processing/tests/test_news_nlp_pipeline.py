import pytest
from src.nlp.news_nlp_pipeline import NewsNLPPipeline

def test_pipeline_init():
    pipeline = NewsNLPPipeline()
    assert pipeline.nlp_en is not None
    assert pipeline.nlp_fr is not None
    assert 'bert' in pipeline.sentiment_models
    assert 'finbert' in pipeline.sentiment_models

def test_preprocess():
    pipeline = NewsNLPPipeline()
    text = '<p>Bitcoin surges to new highs!</p>'
    result = pipeline.preprocess(text)
    assert 'bitcoin' in result['clean_text']
    assert isinstance(result['tokens'], list)

def test_analyze_sentiment():
    pipeline = NewsNLPPipeline()
    text = 'Bitcoin is doing great!'
    result = pipeline.analyze_sentiment(text)
    assert 'label' in result
    assert 'score' in result

def test_extract_entities():
    pipeline = NewsNLPPipeline()
    text = 'Ethereum and Binance are in the news.'
    entities = pipeline.extract_entities(text)
    assert any(e['type'] == 'cryptocurrency' for e in entities)
    assert any(e['type'] == 'company' for e in entities)

def test_predict_market_impact():
    pipeline = NewsNLPPipeline()
    sentiment = {'label': 'positive'}
    entities = [{'text': 'Bitcoin', 'type': 'cryptocurrency'}]
    impact = pipeline.predict_market_impact(sentiment, entities)
    assert impact['impact'] in ['positive', 'neutral', 'negative']

def test_score_source_credibility():
    pipeline = NewsNLPPipeline()
    result = pipeline.score_source_credibility('https://www.coindesk.com/article')
    assert result['label'] in ['trusted', 'low', 'unknown']

def test_analyze_trends():
    pipeline = NewsNLPPipeline()
    articles = [
        {'date': '2024-01-01', 'sentiment': {'score': 0.8}, 'entities': [{'text': 'bitcoin', 'type': 'cryptocurrency'}]},
        {'date': '2024-01-01', 'sentiment': {'score': 0.6}, 'entities': [{'text': 'bitcoin', 'type': 'cryptocurrency'}]},
        {'date': '2024-01-02', 'sentiment': {'score': -0.5}, 'entities': [{'text': 'ethereum', 'type': 'cryptocurrency'}]},
    ]
    trends = pipeline.analyze_trends(articles)
    assert any(t['entity'] == 'bitcoin' for t in trends)
    assert any(t['entity'] == 'ethereum' for t in trends)

def test_cache_article():
    pipeline = NewsNLPPipeline()
    pipeline.cache_article('id1', {'foo': 'bar'})
    assert 'id1' in pipeline.cache

def test_batch_process():
    pipeline = NewsNLPPipeline()
    articles = [
        {'id': '1', 'text': 'Bitcoin is up!', 'date': '2024-01-01', 'source_url': 'https://coindesk.com'},
        {'id': '2', 'text': 'Ethereum is down.', 'date': '2024-01-02', 'source_url': 'https://cointelegraph.com'},
    ]
    results = pipeline.batch_process(articles)
    assert len(results) == 2
    assert all('sentiment' in r for r in results) 