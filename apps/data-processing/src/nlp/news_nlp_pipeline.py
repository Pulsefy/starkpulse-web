"""
news_nlp_pipeline.py
Advanced NLP pipeline for cryptocurrency news sentiment analysis and market impact prediction.
"""

import re
import spacy
from spacy_langdetect import LanguageDetector
from transformers import pipeline, AutoTokenizer

class NewsNLPPipeline:
    """
    Pipeline for analyzing news sentiment, predicting market impact, and extracting entities.
    """
    def __init__(self, model_version='default', language='en'):
        """
        Initialize models, spaCy pipelines, and configuration.
        """
        self.language = language
        self.model_version = model_version
        # Load spaCy pipelines
        self.nlp_en = spacy.load('en_core_web_sm')
        self.nlp_fr = spacy.load('fr_core_news_sm')
        if not any(pipe[0] == 'language_detector' for pipe in self.nlp_en.pipeline):
            self.nlp_en.add_pipe('language_detector', last=True)
        if not any(pipe[0] == 'language_detector' for pipe in self.nlp_fr.pipeline):
            self.nlp_fr.add_pipe('language_detector', last=True)
        # Load sentiment models
        self.sentiment_models = {
            'bert': pipeline('sentiment-analysis', model='nlptown/bert-base-multilingual-uncased-sentiment'),
            'finbert': pipeline('sentiment-analysis', model='yiyanghkust/finbert-tone')
        }
        # Tokenizers for advanced use
        self.tokenizers = {
            'bert': AutoTokenizer.from_pretrained('nlptown/bert-base-multilingual-uncased-sentiment'),
            'finbert': AutoTokenizer.from_pretrained('yiyanghkust/finbert-tone')
        }
        self.cache = {}
        self.metrics = {}

    def preprocess(self, text, language=None):
        """
        Clean and preprocess news content (HTML removal, normalization, tokenization, etc.).
        Detect language if not provided.
        """
        # Remove HTML tags
        clean_text = re.sub(r'<.*?>', '', text)
        # Normalize whitespace
        clean_text = re.sub(r'\s+', ' ', clean_text).strip()
        # Lowercase
        clean_text = clean_text.lower()
        # Language detection
        lang = language or self.detect_language(clean_text)
        # Tokenization, lemmatization
        nlp = self.nlp_en if lang == 'en' else self.nlp_fr
        doc = nlp(clean_text)
        tokens = [token.lemma_ for token in doc if not token.is_stop and not token.is_punct]
        return {
            'clean_text': clean_text,
            'language': lang,
            'tokens': tokens
        }

    def detect_language(self, text):
        """
        Detect the language of the text using spaCy pipeline.
        """
        doc = self.nlp_en(text)
        if hasattr(doc._, 'language') and doc._.language and doc._.language['score'] > 0.8:
            return doc._.language['language']
        doc = self.nlp_fr(text)
        if hasattr(doc._, 'language') and doc._.language and doc._.language['score'] > 0.8:
            return doc._.language['language']
        return 'en'  # Default fallback

    def analyze_sentiment(self, text, language='en', model_version=None):
        """
        Run sentiment analysis using BERT/FinBERT. Return sentiment score/classification.
        """
        # Choose model: default to FinBERT for EN, BERT for others
        model_key = model_version or ('finbert' if language == 'en' else 'bert')
        if model_key not in self.sentiment_models:
            raise ValueError(f"Model {model_key} not available. Choose from {list(self.sentiment_models.keys())}")
        sentiment_pipeline = self.sentiment_models[model_key]
        # Preprocess text (cleaning, language detection)
        processed = self.preprocess(text, language=language)
        clean_text = processed['clean_text']
        # Run sentiment analysis
        result = sentiment_pipeline(clean_text)
        # HuggingFace pipeline returns a list of dicts
        if isinstance(result, list) and len(result) > 0:
            sentiment = result[0]
            return {
                'label': sentiment.get('label'),
                'score': sentiment.get('score'),
                'model': model_key,
                'language': processed['language']
            }
        return {
            'label': None,
            'score': None,
            'model': model_key,
            'language': processed['language']
        }

    def predict_market_impact(self, sentiment_score, entities, features=None):
        """
        Predict market impact using ML algorithms (scikit-learn, etc.).
        """
        # Placeholder: In production, load a trained scikit-learn model
        # For demonstration, use a simple rule-based approach
        # Example: If sentiment is positive and mentions a major crypto, predict positive impact
        major_cryptos = {'bitcoin', 'btc', 'ethereum', 'eth'}
        impact = 'neutral'
        score = 0.0
        if sentiment_score and sentiment_score.get('label'):
            label = sentiment_score['label'].lower()
            has_major = any(e['text'].lower() in major_cryptos for e in entities if e['type'] == 'cryptocurrency')
            if label in ['positive', 'bullish', '5 stars', '4 stars'] and has_major:
                impact = 'positive'
                score = 0.8
            elif label in ['negative', 'bearish', '1 star', '2 stars'] and has_major:
                impact = 'negative'
                score = -0.8
            else:
                impact = 'neutral'
                score = 0.0
        # If a trained model is available, use it here (e.g., sklearn.predict)
        # if self.market_impact_model:
        #     score = self.market_impact_model.predict(features)
        return {
            'impact': impact,
            'score': score
        }

    def extract_entities(self, text, language='en'):
        """
        Extract cryptocurrency and company entities using spaCy and custom rules.
        """
        # Example lists (should be replaced with comprehensive sources or external data)
        crypto_keywords = {'bitcoin', 'btc', 'ethereum', 'eth', 'solana', 'sol', 'dogecoin', 'doge', 'binance', 'bnb'}
        company_keywords = {'binance', 'coinbase', 'kraken', 'bitfinex', 'tether', 'circle', 'microstrategy'}
        nlp = self.nlp_en if language == 'en' else self.nlp_fr
        doc = nlp(text)
        entities = []
        # Use spaCy NER
        for ent in doc.ents:
            if ent.label_ in {'ORG', 'PRODUCT'} and ent.text.lower() in company_keywords:
                entities.append({'text': ent.text, 'type': 'company'})
            if ent.label_ in {'ORG', 'PRODUCT', 'MONEY'} and ent.text.lower() in crypto_keywords:
                entities.append({'text': ent.text, 'type': 'cryptocurrency'})
        # Custom rule-based matching
        for token in doc:
            if token.text.lower() in crypto_keywords:
                entities.append({'text': token.text, 'type': 'cryptocurrency'})
            if token.text.lower() in company_keywords:
                entities.append({'text': token.text, 'type': 'company'})
        # Remove duplicates
        unique_entities = { (e['text'].lower(), e['type']): e for e in entities }
        return list(unique_entities.values())

    def score_source_credibility(self, source_url):
        """
        Score the credibility of the news source.
        """
        # Placeholder: In production, use a database or external API for credibility
        trusted_sources = {'coindesk.com', 'cointelegraph.com', 'reuters.com', 'bloomberg.com'}
        low_quality_sources = {'cryptotabloid.com', 'fakenewscrypto.com'}
        score = 0.5
        label = 'unknown'
        for domain in trusted_sources:
            if domain in source_url:
                score = 0.9
                label = 'trusted'
                break
        for domain in low_quality_sources:
            if domain in source_url:
                score = 0.1
                label = 'low'
                break
        return {'score': score, 'label': label}

    def analyze_trends(self, articles):
        """
        Aggregate sentiment trends over time/entities/sources.
        articles: list of dicts with 'date', 'sentiment', 'entities', etc.
        """
        from collections import defaultdict
        trends = defaultdict(lambda: {'count': 0, 'score_sum': 0.0})
        for article in articles:
            date = article.get('date')
            sentiment = article.get('sentiment', {})
            score = sentiment.get('score', 0.0)
            for entity in article.get('entities', []):
                key = (date, entity['text'].lower())
                trends[key]['count'] += 1
                trends[key]['score_sum'] += score
        # Calculate average sentiment per entity per date
        trend_data = []
        for (date, entity), data in trends.items():
            avg_score = data['score_sum'] / data['count'] if data['count'] else 0.0
            trend_data.append({'date': date, 'entity': entity, 'avg_sentiment': avg_score, 'mentions': data['count']})
        return trend_data

    def cache_article(self, article_id, processed_data):
        """
        Cache processed news articles for efficiency.
        """
        self.cache[article_id] = processed_data
        return True

    def document_performance_metrics(self, model_name, metrics):
        """
        Store and retrieve model performance and accuracy metrics.
        Args:
            model_name (str): Name of the model (e.g., 'bert', 'finbert')
            metrics (dict): Dictionary of performance metrics (accuracy, F1, etc.)
        Returns:
            dict: All stored metrics
        """
        self.metrics[model_name] = metrics
        return self.metrics

    def batch_process(self, articles):
        """
        Batch process historical news articles.
        articles: list of dicts with 'id', 'text', 'date', 'source_url', etc.
        """
        results = []
        for article in articles:
            text = article.get('text', '')
            language = article.get('language', 'en')
            article_id = article.get('id')
            preprocessed = self.preprocess(text, language=language)
            sentiment = self.analyze_sentiment(text, language=language)
            entities = self.extract_entities(text, language=language)
            impact = self.predict_market_impact(sentiment, entities)
            credibility = self.score_source_credibility(article.get('source_url', ''))
            result = {
                'id': article_id,
                'preprocessed': preprocessed,
                'sentiment': sentiment,
                'entities': entities,
                'impact': impact,
                'credibility': credibility,
                'date': article.get('date'),
                'source_url': article.get('source_url')
            }
            self.cache_article(article_id, result)
            results.append(result)
        return results

    # Additional methods for model versioning, A/B testing, multilingual support, etc. 