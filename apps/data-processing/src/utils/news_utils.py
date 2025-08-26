import nltk
from transformers import pipeline
from nltk.sentiment.vader import SentimentIntensityAnalyzer

# --- Initialize Models ---
# We initialize the models here so they are loaded only once when the module is imported.
try:
    # Download VADER lexicon if not already present
    nltk.data.find('sentiment/vader_lexicon.zip')
except nltk.downloader.DownloadError:
    print("Downloading VADER lexicon...")
    nltk.download('vader_lexicon')

SID = SentimentIntensityAnalyzer()
CLASSIFIER = pipeline("zero-shot-classification", model="facebook/bart-large-mnli")
CANDIDATE_LABELS = ["Regulation", "Market Analysis", "DeFi", "NFTs", "Security", "Adoption", "Partnership"]

def get_sentiment(text: str) -> float:
    """
    Analyzes the sentiment of a given text using VADER.

    Args:
        text: The input string to analyze.

    Returns:
        A compound sentiment score from -1.0 (very negative) to 1.0 (very positive).
    """
    if not text or not isinstance(text, str):
        return 0.0

    # Return the 'compound' score from VADER
    return SID.polarity_scores(text)['compound']

def classify_topic(text: str) -> str:
    """
    Classifies the topic of a given text using a zero-shot classification model.

    Args:
        text: The input string to classify.

    Returns:
        The most likely topic from the candidate labels.
    """
    if not text or not isinstance(text, str):
        return "Uncategorized"

    # The classifier returns a dictionary with labels and scores
    result = CLASSIFIER(text, CANDIDATE_LABELS)

    # Return the label with the highest score
    return result['labels'][0]